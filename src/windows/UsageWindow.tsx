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
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getSettings, getSetting, setSetting } from "../api/settings";
import { restorePrefixedWindowState } from "../utils/windowState";
import { getSessions } from "../api/sessions";
import { getFrameworkUsage, type FrameworkUsageEntry } from "../api/frameworkMetrics";
import { getDeliveryEvents, type DeliveryEvent } from "../api/delivery";
import { FrameworkMetricsView } from "../components/FrameworkMetricsView";
import { formatTokens } from "../utils/frameworkAggregates";
import {
  deriveDeliveryLines,
  medianLeadMs,
  formatLead,
} from "../utils/deliveryMetrics";
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
  const [deliveryEvents, setDeliveryEvents] = useState<DeliveryEvent[]>([]);
  const [tick, setTick] = useState(0);
  const [pinned, setPinned] = useState(false);

  // Part of the setup: restore this window's own geometry, apply the
  // saved always-on-top pin, and remember open/closed across launches
  // (App.tsx reopens the window on start when usage_window_open = "1").
  useEffect(() => {
    setSetting("usage_window_open", "1").catch(() => undefined);
    getSettings()
      .then((s) => restorePrefixedWindowState(s, "usage_window", { minW: 520, minH: 400 }))
      .catch(() => undefined);
    getSetting("usage_window_pinned")
      .then((v) => {
        const on = v === "1";
        setPinned(on);
        if (on) return getCurrentWindow().setAlwaysOnTop(true);
      })
      .catch(() => undefined);
    let unlisten: (() => void) | null = null;
    getCurrentWindow()
      .onCloseRequested(() => {
        setSetting("usage_window_open", "0").catch(() => undefined);
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => undefined);
    return () => {
      unlisten?.();
    };
  }, []);

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    getCurrentWindow().setAlwaysOnTop(next).catch(() => undefined);
    setSetting("usage_window_pinned", next ? "1" : "0").catch(() => undefined);
  };

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
      getDeliveryEvents()
        .then((d) => {
          if (!cancelled && Array.isArray(d)) setDeliveryEvents(d);
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
        <button
          type="button"
          className={`usage-window-pin${pinned ? " is-pinned" : ""}`}
          onClick={togglePin}
          title={pinned ? "Desafixar (deixa de ficar sobre as outras janelas)" : "Fixar sempre visível (always on top)"}
          aria-pressed={pinned}
        >
          📌
        </button>
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

      <DeliverySection events={deliveryEvents} />

      <section className="usage-window-metrics">
        <FrameworkMetricsView refreshToken={tick} />
      </section>
    </div>
  );
}

/** Lead-time view (M5): task_started → PR aberto per task, plus the
 *  observed full cycle to merge.  Data from delivery_events. */
function DeliverySection({ events }: { events: DeliveryEvent[] }) {
  const lines = useMemo(() => deriveDeliveryLines(events), [events]);
  if (lines.length === 0) return null;
  const median = medianLeadMs(lines);
  return (
    <section className="usage-window-sessions" data-testid="usage-window-delivery">
      <div className="usage-window-title">
        Delivery — lead time tarefa → PR
        {median !== null && (
          <span className="usage-window-median"> · mediana {formatLead(median)}</span>
        )}
      </div>
      <table className="usage-window-table">
        <thead>
          <tr>
            <th>Branch</th>
            <th>Início</th>
            <th>PR aberto</th>
            <th>Lead</th>
            <th>Ciclo (merge)</th>
          </tr>
        </thead>
        <tbody>
          {lines.slice(0, 20).map((l) => (
            <tr key={l.sessionId}>
              <td>{l.branch ?? l.sessionId.slice(0, 8)}</td>
              <td className="mono">{l.startedAt?.slice(0, 16).replace("T", " ") ?? "—"}</td>
              <td className="mono">
                {l.prUrl ? (
                  <a href={l.prUrl} target="_blank" rel="noreferrer">
                    {l.prOpenedAt?.slice(0, 16).replace("T", " ") ?? "aberto"}
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="mono">{formatLead(l.leadMs)}</td>
              <td className="mono">{formatLead(l.cycleMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
