/**
 * deliveryMetrics (M5) — pure lead-time math over delivery_events.
 */
import { describe, it, expect } from "vitest";
import {
  deriveDeliveryLines,
  medianLeadMs,
  formatLead,
  pendingMergeChecks,
} from "../utils/deliveryMetrics";
import type { DeliveryEvent } from "../api/delivery";

function ev(overrides: Partial<DeliveryEvent>): DeliveryEvent {
  return {
    session_id: "s1",
    repo_path: "/repo",
    branch: "feat/x",
    event: "task_started",
    pr_number: null,
    pr_url: null,
    recorded_at: "2026-07-12 10:00:00",
    ...overrides,
  };
}

describe("deriveDeliveryLines", () => {
  it("computes task_started → pr_opened lead per session", () => {
    const lines = deriveDeliveryLines([
      ev({ event: "task_started", recorded_at: "2026-07-12 10:00:00" }),
      ev({
        event: "pr_opened",
        pr_number: 42,
        pr_url: "https://github.com/x/y/pull/42",
        // gh timestamp — full ISO with Z
        recorded_at: "2026-07-12T13:12:00Z",
      }),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].branch).toBe("feat/x");
    // 3h12min = 11_520_000 ms
    expect(lines[0].leadMs).toBe(11_520_000);
    expect(lines[0].cycleMs).toBeNull();
    expect(formatLead(lines[0].leadMs)).toBe("3.2h");
  });

  it("computes full cycle when merged, and handles open-PR-less sessions", () => {
    const lines = deriveDeliveryLines([
      ev({ session_id: "a", event: "task_started", recorded_at: "2026-07-12 10:00:00" }),
      ev({ session_id: "a", event: "pr_opened", recorded_at: "2026-07-12T11:00:00Z" }),
      ev({ session_id: "a", event: "pr_merged", recorded_at: "2026-07-12T15:00:00Z" }),
      ev({ session_id: "b", event: "task_started", recorded_at: "2026-07-12 12:00:00" }),
    ]);
    const a = lines.find((l) => l.sessionId === "a")!;
    const b = lines.find((l) => l.sessionId === "b")!;
    expect(a.leadMs).toBe(3_600_000);
    expect(a.cycleMs).toBe(5 * 3_600_000);
    expect(b.leadMs).toBeNull();
    // newest start first
    expect(lines[0].sessionId).toBe("b");
  });

  it("ignores negative diffs (clock skew) instead of reporting nonsense", () => {
    const lines = deriveDeliveryLines([
      ev({ event: "task_started", recorded_at: "2026-07-12 10:00:00" }),
      ev({ event: "pr_opened", recorded_at: "2026-07-12T09:00:00Z" }),
    ]);
    expect(lines[0].leadMs).toBeNull();
  });
});

describe("medianLeadMs", () => {
  it("median over sessions with a lead; null when none", () => {
    expect(medianLeadMs([])).toBeNull();
    const lines = deriveDeliveryLines([
      ev({ session_id: "a", event: "task_started", recorded_at: "2026-07-12T10:00:00Z" }),
      ev({ session_id: "a", event: "pr_opened", recorded_at: "2026-07-12T11:00:00Z" }),
      ev({ session_id: "b", event: "task_started", recorded_at: "2026-07-12T10:00:00Z" }),
      ev({ session_id: "b", event: "pr_opened", recorded_at: "2026-07-12T13:00:00Z" }),
      ev({ session_id: "c", event: "task_started", recorded_at: "2026-07-12T10:00:00Z" }),
    ]);
    // leads: 1h, 3h → median 2h
    expect(medianLeadMs(lines)).toBe(2 * 3_600_000);
  });
});

describe("pendingMergeChecks", () => {
  it("returns only opened-but-unmerged PRs with repo and number", () => {
    const events = [
      // a: opened + merged — settled, not pending
      ev({ session_id: "a", event: "task_started" }),
      ev({ session_id: "a", event: "pr_opened", pr_number: 1, pr_url: "u1" }),
      ev({ session_id: "a", event: "pr_merged", pr_number: 1 }),
      // b: opened, unmerged — PENDING
      ev({ session_id: "b", event: "task_started" }),
      ev({ session_id: "b", event: "pr_opened", pr_number: 2, pr_url: "u2" }),
      // c: no PR at all
      ev({ session_id: "c", event: "task_started" }),
      // d: opened but pr_number missing — nothing actionable to query
      ev({ session_id: "d", event: "pr_opened", pr_number: null }),
    ];
    const pending = pendingMergeChecks(events);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      sessionId: "b",
      repoPath: "/repo",
      prNumber: 2,
      prUrl: "u2",
    });
  });
});

describe("formatLead", () => {
  it("scales minutes → hours → days", () => {
    expect(formatLead(null)).toBe("—");
    expect(formatLead(45 * 60_000)).toBe("45min");
    expect(formatLead(5.5 * 3_600_000)).toBe("5.5h");
    expect(formatLead(72 * 3_600_000)).toBe("3.0d");
  });
});
