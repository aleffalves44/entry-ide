/**
 * Framework metrics derivation — pure-function tests.
 *
 * Covers command/phase attribution and turn-row derivation including the
 * per-model and per-subagent breakdowns and their dedup-key namespacing.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  commandFromUserText,
  phaseFromCommand,
  deriveTurnRows,
  _resetFrameworkMetricsForTest,
} from "../agent/frameworkMetrics";
import { emptyState } from "../agent/messageStore";
import type { AgentSessionState, RenderedMessage } from "../agent/messageStore";
import type { InitEvent, ResultEvent } from "../agent/types";

/* ─── fixtures ─────────────────────────────────────────────────────── */

const INIT: InitEvent = {
  type: "system",
  subtype: "init",
  cwd: "/repo",
  session_id: "sess1",
  uuid: "init-1",
  tools: [],
  slash_commands: [],
  mcp_servers: [],
  model: "claude-sonnet-5",
  permissionMode: "default",
} as unknown as InitEvent;

function userMsg(text: string, ts: number): RenderedMessage {
  return {
    id: `user-${ts}`,
    role: "user",
    blocks: [{ type: "text", text }],
    timestamp: ts,
  } as RenderedMessage;
}

function assistantMsg(
  id: string,
  ts: number,
  opts: {
    blocks?: RenderedMessage["blocks"];
    parentToolUseId?: string;
    usage?: { output_tokens?: number; input_tokens?: number };
  } = {},
): RenderedMessage {
  return {
    id,
    role: "assistant",
    blocks: opts.blocks ?? [{ type: "text", text: "ok" }],
    parentToolUseId: opts.parentToolUseId ?? null,
    usage: opts.usage,
    timestamp: ts,
  } as RenderedMessage;
}

const RESULT: ResultEvent = {
  type: "result",
  subtype: "success",
  is_error: false,
  uuid: "turn-1",
  duration_ms: 45_000,
  total_cost_usd: 0.31,
  usage: {
    input_tokens: 1200,
    output_tokens: 800,
    cache_read_input_tokens: 90_000,
    cache_creation_input_tokens: 500,
  },
};

function baseState(messages: RenderedMessage[]): AgentSessionState {
  const s = emptyState();
  return {
    ...s,
    initialized: true,
    initEvent: INIT,
    messages,
    resultEvent: RESULT,
  };
}

beforeEach(() => {
  _resetFrameworkMetricsForTest();
});

/* ─── command / phase attribution ──────────────────────────────────── */

describe("commandFromUserText", () => {
  it("extracts a plugin-qualified command and drops the args", () => {
    expect(commandFromUserText("/harness-cmd:task CRED-1234 fix bug")).toBe(
      "harness-cmd:task",
    );
  });

  it("returns null for prose", () => {
    expect(commandFromUserText("please fix the bug")).toBeNull();
  });

  it("returns null for a bare slash", () => {
    expect(commandFromUserText("/")).toBeNull();
  });

  it("handles leading whitespace", () => {
    expect(commandFromUserText("  /plan thing")).toBe("plan");
  });
});

describe("phaseFromCommand", () => {
  it("maps plugin-qualified commands to their SDD phase", () => {
    expect(phaseFromCommand("harness-cmd:spike")).toBe("spike");
    expect(phaseFromCommand("harness-cmd:plan")).toBe("plan");
    expect(phaseFromCommand("harness-cmd:task")).toBe("task");
    expect(phaseFromCommand("harness-cmd:pr")).toBe("pr");
  });

  it("maps bare commands too", () => {
    expect(phaseFromCommand("plan")).toBe("plan");
  });

  it("returns null for non-phase commands and null input", () => {
    expect(phaseFromCommand("harness-cmd:ai-context")).toBeNull();
    expect(phaseFromCommand("compact")).toBeNull();
    expect(phaseFromCommand(null)).toBeNull();
  });
});

/* ─── deriveTurnRows ───────────────────────────────────────────────── */

describe("deriveTurnRows", () => {
  it("produces an authoritative turn row from the result event", () => {
    const state = baseState([
      userMsg("/harness-cmd:task CRED-1", 100),
      assistantMsg("a1", 110),
    ]);
    const rows = deriveTurnRows("sess1", state, RESULT);

    const turn = rows.find((r) => r.kind === "turn");
    expect(turn).toBeDefined();
    expect(turn).toMatchObject({
      session_id: "sess1",
      turn_uuid: "turn-1",
      agent: "main",
      model: "claude-sonnet-5",
      command: "harness-cmd:task",
      phase: "task",
      input_tokens: 1200,
      output_tokens: 800,
      cache_read_tokens: 90_000,
      cache_creation_tokens: 500,
      duration_ms: 45_000,
    });
    // D3: cost is COMPUTED from the turn's usage × sonnet rates —
    // (1200×$3 + 800×$15 + 500×$3.75 + 90000×$0.30) / 1M — never the
    // session-cumulative result.total_cost_usd (0.31 in the fixture).
    expect(turn!.cost_usd).toBeCloseTo(0.044475, 6);
  });

  it("inherits the session's active command on follow-up turns (D4)", () => {
    // Turn 1: explicit slash latches the command.
    deriveTurnRows("sess1", baseState([userMsg("/harness-cmd:plan CRED-9", 100)]), RESULT);
    // Turn 2 (same session): prose follow-up — still belongs to /plan.
    const rows = deriveTurnRows(
      "sess1",
      baseState([userMsg("continue de onde parou", 200)]),
      { ...RESULT, uuid: "turn-2" },
    );
    const turn = rows.find((r) => r.kind === "turn")!;
    expect(turn.command).toBe("harness-cmd:plan");
    // A DIFFERENT session inherits nothing.
    const other = deriveTurnRows(
      "sess2",
      baseState([userMsg("oi", 300)]),
      { ...RESULT, uuid: "turn-3" },
    );
    expect(other.find((r) => r.kind === "turn")!.command).toBeNull();
  });

  it("records prose turns with null command/phase", () => {
    const state = baseState([userMsg("fix the bug", 100), assistantMsg("a1", 110)]);
    const rows = deriveTurnRows("sess1", state, RESULT);
    const turn = rows.find((r) => r.kind === "turn")!;
    expect(turn.command).toBeNull();
    expect(turn.phase).toBeNull();
  });

  it("emits model rows only when more than one model ran", () => {
    const single = deriveTurnRows(
      "sess1",
      baseState([userMsg("/plan x", 100)]),
      { ...RESULT, modelUsage: { "claude-sonnet-5": { inputTokens: 10 } } },
    );
    expect(single.filter((r) => r.kind === "model")).toHaveLength(0);

    const multi = deriveTurnRows(
      "sess1",
      baseState([userMsg("/plan x", 100)]),
      {
        ...RESULT,
        modelUsage: {
          "claude-sonnet-5": { inputTokens: 10, outputTokens: 20, costUSD: 0.1 },
          "claude-haiku-4-5": { inputTokens: 5, outputTokens: 8, costUSD: 0.01 },
        },
      },
    );
    const modelRows = multi.filter((r) => r.kind === "model");
    expect(modelRows).toHaveLength(2);
    const haiku = modelRows.find((r) => r.model === "claude-haiku-4-5")!;
    expect(haiku.input_tokens).toBe(5);
    expect(haiku.output_tokens).toBe(8);
    expect(haiku.cost_usd).toBe(0.01);
    // Dedup keys are namespaced per model — never collide with the turn row.
    expect(new Set(multi.map((r) => `${r.turn_uuid}|${r.agent}`)).size).toBe(multi.length);
  });

  it("emits agent rows for subagents dispatched this turn, summing output tokens", () => {
    const taskBlock = {
      type: "tool_use" as const,
      id: "tu1",
      name: "Task",
      input: { subagent_type: "Build", description: "Build the feature" },
    };
    const state = baseState([
      userMsg("/harness-cmd:task go", 100),
      assistantMsg("a1", 110, { blocks: [taskBlock] }),
      // The reducer merges stream events per message id, so the state holds
      // ONE message per subagent API call with its final usage.
      assistantMsg("sub1", 120, {
        parentToolUseId: "tu1",
        usage: { output_tokens: 500, input_tokens: 90_000 },
      }),
      assistantMsg("sub2", 125, {
        parentToolUseId: "tu1",
        usage: { output_tokens: 700, input_tokens: 95_000 },
      }),
    ]);
    const rows = deriveTurnRows("sess1", state, RESULT);

    const agentRows = rows.filter((r) => r.kind === "agent");
    expect(agentRows.length).toBeGreaterThanOrEqual(1);
    expect(agentRows[0].agent).toBe("Build");
    // D1: sums of the subagent's OWN per-message usage — output stays
    // output, input is the billed per-call sum (not fabricated zeros,
    // not the handoff's in+out+cache total).
    const totalOutput = agentRows.reduce((n, r) => n + r.output_tokens, 0);
    expect(totalOutput).toBe(1200);
    expect(agentRows[0].input_tokens).toBe(185_000);
    // D2: cost computed from that usage — never $0 with tokens > 0.
    // (90000×$3 + 500×$15 + 95000×$3 + 700×$15) / 1M = 0.573
    expect(agentRows[0].cost_usd).toBeCloseTo(0.573, 6);
    expect(agentRows[0].turn_uuid).toContain("turn-1:agent:tu1");
  });

  it("uses stream usage for tokens; the handoff <usage> only supplies duration fallback", () => {
    const taskBlock = {
      type: "tool_use" as const,
      id: "tu9",
      name: "Task",
      input: { subagent_type: "Build" },
    };
    const state = baseState([
      userMsg("/harness-cmd:task go", 100),
      assistantMsg("a1", 110, { blocks: [taskBlock] }),
      // D1: per-message usage IS the token source — the handoff
      // total_tokens (in+out+cache mixed) must never land in a token
      // column again.
      assistantMsg("sub1", 120, { parentToolUseId: "tu9", usage: { output_tokens: 63 } }),
    ]);
    state.toolResults.set("tu9", {
      type: "tool_result",
      tool_use_id: "tu9",
      content:
        "All done.\n<usage>\ntotal_tokens: 48213\ntool_uses: 17\nduration_ms: 92500\n</usage>",
      is_error: false,
    } as never);

    const rows = deriveTurnRows("sess1", state, RESULT);
    const agentRow = rows.find((r) => r.kind === "agent")!;
    expect(agentRow.output_tokens).toBe(63);
    expect(agentRow.output_tokens).not.toBe(48213); // handoff total ≠ output
    expect(agentRow.duration_ms).toBe(92500); // handoff still ok for duration
    expect(agentRow.agent).toBe("Build");
  });

  it("does not re-emit agent rows for Task blocks from previous turns", () => {
    const oldTask = {
      type: "tool_use" as const,
      id: "tu-old",
      name: "Task",
      input: { subagent_type: "Explore" },
    };
    const state = baseState([
      userMsg("/plan first", 50),
      assistantMsg("a0", 60, { blocks: [oldTask] }),
      assistantMsg("sub-old", 70, { parentToolUseId: "tu-old", usage: { output_tokens: 100 } }),
      userMsg("/harness-cmd:task second", 100),
      assistantMsg("a1", 110),
    ]);
    const rows = deriveTurnRows("sess1", state, RESULT);
    expect(rows.filter((r) => r.kind === "agent")).toHaveLength(0);
  });
});
