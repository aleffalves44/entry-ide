/**
 * Parsing helpers for Task (subagent) tool_result payloads.
 *
 * The harness appends a structured `<usage>` block to every subagent
 * result — `total_tokens`, `tool_uses`, `duration_ms` — which is the
 * authoritative per-subagent usage source (stream events only carry
 * partial per-call usage).  Shared by the TaskToolBlock render and the
 * framework metrics recorder.
 */
import type { ContentBlock, ToolResultBlockData } from "./types";

export interface ParsedAgentResult {
  reply: string;
  agentId: string | null;
  usage: Record<string, string> | null;
}

export function parseAgentResult(raw: string): ParsedAgentResult {
  let usage: Record<string, string> | null = null;
  let work = raw;
  const usageMatch = work.match(/<usage>([\s\S]*?)<\/usage>/);
  if (usageMatch) {
    usage = {};
    for (const line of usageMatch[1].split("\n")) {
      const m = line.match(/^\s*([a-z_]+)\s*:\s*(.+?)\s*$/i);
      if (m) usage[m[1]] = m[2];
    }
    work = work.replace(usageMatch[0], "").trim();
  }
  let agentId: string | null = null;
  const agentIdLine = work.match(/^agentId\s*:\s*([a-z0-9-]+)\b.*$/im);
  if (agentIdLine) {
    agentId = agentIdLine[1];
    work = work.replace(agentIdLine[0], "").trim();
  }
  work = work.replace(/\(use\s+SendMessage[^)]*\)/gi, "").trim();
  return { reply: work, agentId, usage };
}

export function resultText(result: ToolResultBlockData | undefined): string {
  if (!result) return "";
  if (typeof result.content === "string") return result.content;
  if (!Array.isArray(result.content)) return "";
  return result.content
    .map((b: ContentBlock) => {
      if (b.type === "text" && typeof (b as { text?: unknown }).text === "string") {
        return (b as { text: string }).text;
      }
      return "";
    })
    .join("\n")
    .trim();
}
