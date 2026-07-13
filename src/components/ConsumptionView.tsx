/**
 * ConsumptionView — the "Consumo Geral" content, host-agnostic.
 *
 * Mounted in two hosts:
 *   • Workbench → "Consumo" tab (docked in the IDE, part of the setup)
 *   • UsageWindow (standalone native window, second-monitor use)
 *
 * Reads ONLY via Tauri commands (get_sessions, get_framework_usage)
 * on a light poll — no SessionContext dependency,
 * so both hosts share identical behavior.  Focusing a session is the
 * host's business (in-app dispatch vs cross-window event) — injected
 * via `onFocusSession`.
 */
import "../styles/components/UsageWindow.css";
import { useEffect, useMemo, useState } from "react";
import { getSessions } from "../api/sessions";
import { getFrameworkUsage, type FrameworkUsageEntry } from "../api/frameworkMetrics";
import { FrameworkMetricsView } from "./FrameworkMetricsView";
import { formatTokens } from "../utils/frameworkAggregates";
import type { SessionData } from "../types/session";

const POLL_MS = 4000;

function formatCost(n: number): string {
  if (n <= 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

export interface ConsumptionViewProps {
  onFocusSession?: (sessionId: string) => void;
  /** Extra header content injected by the host (e.g. the window's pin). */
  headerExtra?: React.ReactNode;
  /** Show the "open in separate window" affordance (docked host only). */
  onOpenWindow?: () => void;
  /** Poll only while visible — hidden Workbench tabs pass false. */
  active?: boolean;
}

export function ConsumptionView({
  onFocusSession,
  headerExtra,
  onOpenWindow,
  active = true,
}: ConsumptionViewProps) {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [rows, setRows] = useState<FrameworkUsageEntry[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const load = () => {
      getSessions()
        .then((s) => {
          if (!cancelled && Array.isArray(s)) setSessions(s);
        })
        .catch(() => undefined);
      getFrameworkUsage()
        .then((r) => {
          if (!cancelled && Array.isArray(r)) setRows(r);
        })
        .catch(() => undefined);
    };
    load();
    const id = setInterval(() => {
      load();
      setTick((t) => t + 1); // refreshToken for FrameworkMetricsView
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active]);

  // Lifetime cost + tokens per session (turn rows only — a turn already
  // includes its subagents).
  const bySession = useMemo(() => {
    const map = new Map<string, { costUsd: number; tokens: number }>();
    for (const r of rows) {
      if (r.kind !== "turn") continue;
      let agg = map.get(r.session_id);
      if (!agg) {
        agg = { costUsd: 0, tokens: 0 };
        map.set(r.session_id, agg);
      }
      agg.costUsd += r.cost_usd;
      agg.tokens += r.input_tokens + r.output_tokens;
    }
    return map;
  }, [rows]);

  const live = sessions.filter((s) => s.phase !== "destroyed");
  const totalCost = [...bySession.values()].reduce((n, a) => n + a.costUsd, 0);
  const totalTokens = [...bySession.values()].reduce((n, a) => n + a.tokens, 0);

  return (
    <div className="usage-window" data-testid="usage-window">
      <header className="usage-window-header">
        <h1>Consumo Geral</h1>
        {headerExtra}
        {onOpenWindow && (
          <button
            type="button"
            className="usage-window-pin"
            onClick={onOpenWindow}
            title="Abrir em janela separada"
          >
            ⧉
          </button>
        )}
        <div className="usage-window-totals">
          {live.length} {live.length === 1 ? "sessão ativa" : "sessões ativas"} ·{" "}
          {formatTokens(totalTokens)} tokens · <strong>{formatCost(totalCost)}</strong>
        </div>
      </header>

      {live.length > 0 && (
        <section className="usage-window-sessions">
          <div className="usage-window-title">Sessões ativas</div>
          <table className="usage-window-table">
            <thead>
              <tr>
                <th>Sessão</th>
                <th>Grupo</th>
                <th>Status</th>
                <th>Tokens</th>
                <th>Custo</th>
              </tr>
            </thead>
            <tbody>
              {live.map((s) => {
                const agg = bySession.get(s.id);
                return (
                  <tr
                    key={s.id}
                    className="usage-window-session-row"
                    title="Clique para focar a sessão"
                    onClick={() => onFocusSession?.(s.id)}
                  >
                    <td>{s.label || s.id.slice(0, 8)}</td>
                    <td>{s.group ?? "—"}</td>
                    <td>{s.phase}</td>
                    <td className="mono">{agg ? formatTokens(agg.tokens) : "—"}</td>
                    <td className="mono">{agg ? formatCost(agg.costUsd) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Delivery/lead-time is capture-only (usePipelineState writes
          delivery_events); this screen neither shows nor fetches it. */}
      <section className="usage-window-metrics">
        <FrameworkMetricsView refreshToken={tick} />
      </section>
    </div>
  );
}
