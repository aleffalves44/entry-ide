/**
 * UsageWindow — standalone "Consumo Geral" window (M4).
 *
 * Runs in its OWN WebviewWindow: no SessionContext, no shared React
 * state.  Everything is read from SQLite via existing Tauri commands on
 * a light poll, so the window can live on a second monitor while the
 * main window works:
 *
 *   • header: totals for the selected period
 *   • active sessions with their lifetime cost — click focuses the
 *     session in the main window (via the `entry://focus-session` event)
 *   • global per-command / per-agent / per-model breakdowns
 *     (FrameworkMetricsView, the same component as the Metrics tab)
 */
import "../styles/components/UsageWindow.css";
import { useEffect, useMemo, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getSessions } from "../api/sessions";
import { getFrameworkUsage, type FrameworkUsageEntry } from "../api/frameworkMetrics";
import { FrameworkMetricsView } from "../components/FrameworkMetricsView";
import { formatTokens } from "../utils/frameworkAggregates";
import type { SessionData } from "../types/session";

const POLL_MS = 4000;

function formatCost(n: number): string {
  if (n <= 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

export function UsageWindow() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [rows, setRows] = useState<FrameworkUsageEntry[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
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
  }, []);

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

  const focusSession = async (sessionId: string) => {
    await emit("entry://focus-session", { sessionId });
    const main = await WebviewWindow.getByLabel("main");
    await main?.setFocus();
  };

  return (
    <div className="usage-window" data-testid="usage-window">
      <header className="usage-window-header">
        <h1>Consumo Geral</h1>
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
                    title="Clique para focar a sessão na janela principal"
                    onClick={() => focusSession(s.id)}
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

      <section className="usage-window-metrics">
        <FrameworkMetricsView refreshToken={tick} />
      </section>
    </div>
  );
}
