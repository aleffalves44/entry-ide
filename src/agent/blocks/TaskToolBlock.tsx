/**
 * TaskToolBlock — compact renderer for the subagent-spawning tool
 * (`Task` in the older fan-out SDK, `agent` / `agent_dispatch` in the
 * newer managed-agent SDK).
 *
 * Renders as a single-line row, matching the SubagentList compact
 * density.  Click the chevron / row to expand: shows the agent's
 * reply (cleaned of agentId / <usage> noise), then a small metadata
 * strip with the agentId + token / tool counts, then a "show raw"
 * affordance.
 *
 *   ▸ ● Subagent · audit src/agent ········· done · 12s
 */
import { useMemo, useState } from "react";
import type { ToolResultBlockData, ToolUseBlockData } from "../types";
import { parseAgentResult, resultText } from "../agentResultParse";
import { MarkdownBody } from "./MarkdownBody";

interface TaskToolBlockProps {
  block: ToolUseBlockData;
  result: ToolResultBlockData | undefined;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`;
}

export function TaskToolBlock({ block, result }: TaskToolBlockProps) {
  const [open, setOpen] = useState(false);

  const description =
    typeof block.input?.description === "string"
      ? (block.input.description as string)
      : null;
  const subagentType =
    typeof block.input?.subagent_type === "string"
      ? (block.input.subagent_type as string)
      : null;
  const name = description ?? subagentType ?? "subagent";

  const text = resultText(result);
  const parsed = useMemo(() => parseAgentResult(text), [text]);

  const status: "running" | "error" | "done" = !result
    ? "running"
    : result.is_error
      ? "error"
      : "done";

  const durationMs = parsed.usage?.duration_ms
    ? parseInt(parsed.usage.duration_ms, 10)
    : null;
  const tokens = parsed.usage?.total_tokens ?? null;
  const toolUses = parsed.usage?.tool_uses ?? null;

  const statusLabel =
    status === "running"
      ? "running"
      : status === "error"
        ? "error"
        : durationMs !== null
          ? `done · ${formatMs(durationMs)}`
          : "done";

  return (
    <div className="agent-task-block" data-status={status} data-expanded={open || undefined}>
      <button
        type="button"
        className="agent-task-block-row"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={name}
      >
        <span className="agent-task-block-chev" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        <span
          className="agent-task-block-dot"
          data-status={status}
          aria-hidden="true"
        />
        <span className="agent-task-block-label">Subagent</span>
        <span className="agent-task-block-name">{name}</span>
        <span className="agent-task-block-status" data-status={status}>
          {statusLabel}
        </span>
      </button>

      {open && (
        <div className="agent-task-block-body">
          {parsed.reply ? (
            <div className="agent-task-block-reply">
              <MarkdownBody source={parsed.reply} />
            </div>
          ) : (
            <p className="agent-task-block-empty">— no reply —</p>
          )}
          {(parsed.agentId || tokens || toolUses) && (
            <div className="agent-task-block-meta">
              {parsed.agentId && (
                <>
                  <span className="agent-task-block-meta-label">id</span>
                  <code className="agent-task-block-meta-id">{parsed.agentId}</code>
                </>
              )}
              {tokens && (
                <>
                  <span className="agent-task-block-meta-sep" />
                  <span className="agent-task-block-meta-label">tokens</span>
                  <span>{Number(tokens).toLocaleString()}</span>
                </>
              )}
              {toolUses && (
                <>
                  <span className="agent-task-block-meta-sep" />
                  <span className="agent-task-block-meta-label">tools</span>
                  <span>{toolUses}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
