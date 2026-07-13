/**
 * Framework usage metrics — turn-level instrumentation.
 *
 * On every `result` event the store calls `recordFrameworkUsageForResult`,
 * which derives rows from the reducer state and persists them via the
 * `record_framework_usage` Tauri command into the local SQLite table
 * `framework_usage`.  Everything is local; nothing leaves the machine.
 *
 * Row kinds
 * ─────────
 *   • `turn`  — one per turn: totals straight from the SDK result event
 *               (usage, cost, duration).  The authoritative row for
 *               aggregate queries.
 *   • `model` — per-model breakdown from `result.modelUsage`, emitted only
 *               when the turn touched more than one model (subagents with
 *               model overrides).  NOT additive with the `turn` row.
 *   • `agent` — per-subagent breakdown.  `output_tokens` is the sum of the
 *               subagent's assistant-message outputs (additive and honest);
 *               `input_tokens` is left at 0 because per-call input tokens
 *               include the whole context window and summing them would
 *               fabricate a number.  NOT additive with the `turn` row.
 *
 * Dedup: the DB has a unique index on (turn_uuid, agent).  `turn` rows use
 * the result uuid verbatim; `model`/`agent` rows namespace it with the
 * model name / tool_use id so replays (session restore re-emitting old
 * events) are idempotent.  An in-memory Set guards the common case before
 * IPC is even attempted.
 */

import { invoke } from "@tauri-apps/api/core";
import type { AgentSessionState, RenderedMessage } from "./messageStore";
import type { ResultEvent, ToolUseBlockData } from "./types";
import { isTextBlock, isToolUseBlock } from "./types";
import { isTaskTool, selectSubagentsForTool } from "./subagentSelectors";
import { parseAgentResult, resultText } from "./agentResultParse";
import { costForUsage } from "../utils/modelPricing";

export interface FrameworkUsageRow {
  session_id: string;
  turn_uuid: string | null;
  kind: "turn" | "model" | "agent";
  provider: string;
  model: string;
  command: string | null;
  agent: string;
  phase: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  duration_ms: number | null;
  cost_usd: number;
}

/* ─── command / phase attribution ──────────────────────────────────── */

/** Last slash command seen per IDE session (D4).  A command's work often
 *  spans multiple turns — and multiple RESUMES of the same logical
 *  session — after the invocation turn.  Turns with no slash initiator
 *  inherit the latched command instead of falling into "(prose)".
 *  Keyed by the IDE session id (stable across respawns); workspace
 *  restore seeds the latch from the predecessor session's rows via
 *  `seedSessionCommand`. */
const lastCommandBySession = new Map<string, string>();

/** Seed the command latch for a session — used on workspace restore to
 *  carry attribution across the old→new session id remap. */
export function seedSessionCommand(sessionId: string, command: string | null): void {
  if (command) lastCommandBySession.set(sessionId, command);
}

/** Extract the slash command that initiated the turn from the user
 *  message text: `/harness-cmd:task CRED-1234` → `harness-cmd:task`.
 *  Prose turns return null. */
export function commandFromUserText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const first = trimmed.split(/\s+/, 1)[0];
  const cmd = first.slice(1);
  return cmd.length > 0 ? cmd : null;
}

/** Map a command to its SDD phase: `harness-cmd:task` → `task`.
 *  Matches on the last path segment so plain `/plan` also qualifies. */
export function phaseFromCommand(command: string | null): string | null {
  if (!command) return null;
  const m = /(?:^|:)(spike|plan|task|pr)$/.exec(command);
  return m ? m[1] : null;
}

function textOf(message: RenderedMessage): string {
  let out = "";
  for (const b of message.blocks) {
    if (isTextBlock(b)) out += b.text;
  }
  return out;
}

/** Latest main-thread user message — the turn initiator. */
function lastMainUserMessage(state: AgentSessionState): RenderedMessage | null {
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const m = state.messages[i];
    if (m.role === "user" && !m.parentToolUseId) return m;
  }
  return null;
}

/* ─── row derivation ───────────────────────────────────────────────── */

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Read a token field from a usage-like object, accepting both the SDK's
 *  snake_case (result.usage) and camelCase (result.modelUsage) shapes. */
function tok(obj: Record<string, unknown> | undefined, snake: string, camel: string): number {
  if (!obj) return 0;
  return num(obj[snake] ?? obj[camel]);
}

export function deriveTurnRows(
  sessionId: string,
  state: AgentSessionState,
  result: ResultEvent,
): FrameworkUsageRow[] {
  const uuid = typeof result.uuid === "string" ? result.uuid : null;
  const initiator = lastMainUserMessage(state);
  // D4: explicit slash wins and re-latches; otherwise inherit the
  // session's active command (a /plan keeps attributing its follow-up
  // turns and resumes until another slash arrives).
  const explicitCommand = initiator ? commandFromUserText(textOf(initiator)) : null;
  if (explicitCommand) lastCommandBySession.set(sessionId, explicitCommand);
  const command = explicitCommand ?? lastCommandBySession.get(sessionId) ?? null;
  const phase = phaseFromCommand(command);
  const model = state.initEvent?.model ?? "unknown";
  const usage = result.usage as Record<string, unknown> | undefined;

  const rows: FrameworkUsageRow[] = [];

  const base = {
    session_id: sessionId,
    provider: "claude",
    command,
    phase,
  };

  // 1. Authoritative turn row.  Cost is COMPUTED from this turn's usage
  //    decomposition × the model's rates (D3): result.total_cost_usd is
  //    the session's CUMULATIVE cost, so persisting it per turn made
  //    sums meaningless; and a single auditable cost function must apply
  //    to main and subagent rows alike (D2).
  const turnTokens = {
    input_tokens: tok(usage, "input_tokens", "inputTokens"),
    output_tokens: tok(usage, "output_tokens", "outputTokens"),
    cache_read_tokens: tok(usage, "cache_read_input_tokens", "cacheReadInputTokens"),
    cache_creation_tokens: tok(usage, "cache_creation_input_tokens", "cacheCreationInputTokens"),
  };
  rows.push({
    ...base,
    turn_uuid: uuid,
    kind: "turn",
    model,
    agent: "main",
    ...turnTokens,
    duration_ms: typeof result.duration_ms === "number" ? result.duration_ms : null,
    cost_usd: costForUsage(model, turnTokens),
  });

  // 2. Per-model breakdown — only interesting when >1 model ran.
  const modelUsage = result.modelUsage as Record<string, Record<string, unknown>> | undefined;
  const modelNames = modelUsage ? Object.keys(modelUsage) : [];
  if (modelUsage && modelNames.length > 1) {
    for (const name of modelNames) {
      const mu = modelUsage[name];
      rows.push({
        ...base,
        turn_uuid: uuid ? `${uuid}:model:${name}` : null,
        kind: "model",
        model: name,
        agent: `model:${name}`,
        input_tokens: tok(mu, "input_tokens", "inputTokens"),
        output_tokens: tok(mu, "output_tokens", "outputTokens"),
        cache_read_tokens: tok(mu, "cache_read_input_tokens", "cacheReadInputTokens"),
        cache_creation_tokens: tok(mu, "cache_creation_input_tokens", "cacheCreationInputTokens"),
        duration_ms: null,
        cost_usd: num(mu?.["costUSD"] ?? mu?.["cost_usd"]),
      });
    }
  }

  // 3. Per-subagent breakdown — Task tool_use blocks dispatched this turn.
  const turnStart = initiator?.timestamp ?? 0;
  for (const m of state.messages) {
    if (m.role !== "assistant" || m.parentToolUseId) continue;
    if ((m.timestamp ?? 0) < turnStart) continue; // previous turns already recorded
    for (const block of m.blocks) {
      if (!isToolUseBlock(block) || !isTaskTool(block.name)) continue;
      rows.push(...subagentRows(sessionId, state, block, { uuid, command, phase, model }));
    }
  }

  return rows;
}

function subagentRows(
  sessionId: string,
  state: AgentSessionState,
  taskBlock: ToolUseBlockData,
  ctx: { uuid: string | null; command: string | null; phase: string | null; model: string },
): FrameworkUsageRow[] {
  const input = taskBlock.input as Record<string, unknown> | undefined;
  const subagentType =
    typeof input?.subagent_type === "string" && input.subagent_type.trim().length > 0
      ? input.subagent_type.trim()
      : null;

  const threads = selectSubagentsForTool(state, taskBlock.id);
  const agentName = subagentType ?? threads[0]?.name ?? taskBlock.name;

  // D1/D2: tokens and cost come from the subagent's OWN stream — every
  // assistant message carries message.usage (in/out/cache) and
  // message.model.  Summing per-message usage is the billed amount, and
  // pricing each message by ITS model handles subagents running a
  // different model than the main thread.  The old source (the Task
  // result's <usage> handoff total_tokens) mixed in+out+cache into the
  // output column — 6-9× the real output — and priced at $0.
  const sums = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
  };
  let costUsd = 0;
  let dominantModel: string | null = null;
  let duration: number | null = null;
  for (const thread of threads) {
    for (const m of thread.transcript) {
      if (m.role !== "assistant" || !m.usage) continue;
      const u = {
        input_tokens: num(m.usage.input_tokens),
        output_tokens: num(m.usage.output_tokens),
        cache_read_tokens: num(m.usage.cache_read_input_tokens),
        cache_creation_tokens: num(m.usage.cache_creation_input_tokens),
      };
      sums.input_tokens += u.input_tokens;
      sums.output_tokens += u.output_tokens;
      sums.cache_read_tokens += u.cache_read_tokens;
      sums.cache_creation_tokens += u.cache_creation_tokens;
      const msgModel = m.model ?? ctx.model;
      costUsd += costForUsage(msgModel, u);
      dominantModel = msgModel;
    }
    if (thread.doneAt !== null && thread.since > 0) {
      duration = (duration ?? 0) + Math.max(0, thread.doneAt - thread.since);
    }
  }

  // Duration fallback: the harness handoff <usage> block, when present.
  // 0 counts as unknown — degenerate/missing thread timestamps, not a
  // real sub-millisecond subagent run.
  if (!duration) {
    const result = state.toolResults.get(taskBlock.id);
    const parsed = result ? parseAgentResult(resultText(result)) : null;
    const parsedDuration = parsed?.usage?.duration_ms ? parseInt(parsed.usage.duration_ms, 10) : NaN;
    if (Number.isFinite(parsedDuration)) duration = parsedDuration;
  }

  // One row per Task invocation ("execução" — see the Metrics caption).
  return [{
    session_id: sessionId,
    turn_uuid: ctx.uuid ? `${ctx.uuid}:agent:${taskBlock.id}` : null,
    kind: "agent",
    provider: "claude",
    model: dominantModel ?? ctx.model,
    command: ctx.command,
    agent: agentName,
    phase: ctx.phase,
    ...sums,
    duration_ms: duration,
    cost_usd: costUsd,
  }];
}

/* ─── recorder ─────────────────────────────────────────────────────── */

const recordedTurns = new Set<string>();

/** Test-only: reset the in-memory dedup guard and the command latch. */
export function _resetFrameworkMetricsForTest(): void {
  recordedTurns.clear();
  lastCommandBySession.clear();
}

/**
 * Fire-and-forget persistence, called by the session store right after a
 * `result` event is folded into state.  Failures are logged and swallowed —
 * metrics must never break the chat.
 */
export function recordFrameworkUsageForResult(
  sessionId: string,
  state: AgentSessionState,
  result: ResultEvent,
): void {
  const uuid = typeof result.uuid === "string" ? result.uuid : null;
  if (uuid) {
    if (recordedTurns.has(uuid)) return;
    recordedTurns.add(uuid);
  }
  let rows: FrameworkUsageRow[];
  try {
    rows = deriveTurnRows(sessionId, state, result);
  } catch (e) {
    console.warn("[frameworkMetrics] derivation failed:", e);
    return;
  }
  if (rows.length === 0) return;
  invoke("record_framework_usage", { rows }).catch((e) => {
    console.warn("[frameworkMetrics] persist failed:", e);
  });
}
