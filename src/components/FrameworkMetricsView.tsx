/**
 * FrameworkMetricsView — consumption of the agentic-harness framework by
 * command, agent, and model, with JSONL export.
 *
 * Mounted in two places:
 *   • Workbench → "Metrics" tab (session-scoped by default, global toggle)
 *   • Cost Dashboard → "Framework" view (always global)
 *
 * Data comes from the local `framework_usage` table; aggregation is pure
 * (`src/utils/frameworkAggregates.ts`).
 */
import "../styles/components/FrameworkMetricsView.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { getFrameworkUsage, exportFrameworkUsage, type FrameworkUsageEntry } from "../api/frameworkMetrics";
import { openUsageWindow } from "../utils/usageWindow";
import {
  aggregateByAgent,
  aggregateByCommand,
  aggregateByModel,
  formatDuration,
  formatTokens,
  isoDaysAgo,
} from "../utils/frameworkAggregates";

function formatCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

interface FrameworkMetricsViewProps {
  /** When set, a session/global scope toggle is shown (session default). */
  sessionId?: string;
  /** Hide the internal days selector when the host already has one. */
  days?: number;
  /** Refresh trigger — bump to refetch (e.g. on turn completion). */
  refreshToken?: number | null;
  /** Show the "open in separate window" button (hidden when this view
   *  is ALREADY inside the standalone usage window). */
  showPopout?: boolean;
}

export function FrameworkMetricsView({ sessionId, days: daysProp, refreshToken, showPopout }: FrameworkMetricsViewProps) {
  const [daysLocal, setDaysLocal] = useState(7);
  const days = daysProp ?? daysLocal;
  const [scope, setScope] = useState<"session" | "global">(sessionId ? "session" : "global");
  const [rows, setRows] = useState<FrameworkUsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getFrameworkUsage({
      since: isoDaysAgo(days),
      sessionId: scope === "session" ? sessionId : undefined,
    })
      .then(setRows)
      .catch((err) => console.warn("[FrameworkMetrics] load failed:", err))
      .finally(() => setLoading(false));
  }, [days, scope, sessionId, refreshToken]);

  const commandAggs = useMemo(() => aggregateByCommand(rows), [rows]);
  const agentAggs = useMemo(() => aggregateByAgent(rows), [rows]);
  const modelAggs = useMemo(() => aggregateByModel(rows), [rows]);
  const maxCommandCost = commandAggs.length > 0 ? Math.max(...commandAggs.map((c) => c.costUsd)) : 0;
  const maxAgentTokens = agentAggs.length > 0 ? Math.max(...agentAggs.map((a) => a.outputTokens)) : 0;
  const totalCost = commandAggs.reduce((n, c) => n + c.costUsd, 0);
  const totalTurns = commandAggs.reduce((n, c) => n + c.turns, 0);

  const exportJsonl = useCallback(async () => {
    try {
      const path = await save({
        defaultPath: "framework-usage.jsonl",
        filters: [{ name: "JSONL", extensions: ["jsonl"] }],
      });
      if (!path) return;
      const n = await exportFrameworkUsage(path, isoDaysAgo(days));
      setExportStatus(`${n} linhas exportadas`);
    } catch (e) {
      setExportStatus(`Export falhou: ${e}`);
    }
  }, [days]);

  return (
    <div className="fw-metrics" data-testid="framework-metrics-view">
      <div className="fw-metrics-toolbar">
        {sessionId && (
          <div className="fw-metrics-scope">
            <button
              className={`fw-metrics-chip ${scope === "session" ? "active" : ""}`}
              onClick={() => setScope("session")}
            >
              Esta sessão
            </button>
            <button
              className={`fw-metrics-chip ${scope === "global" ? "active" : ""}`}
              onClick={() => setScope("global")}
            >
              Global
            </button>
          </div>
        )}
        {daysProp == null && (
          <div className="fw-metrics-scope">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                className={`fw-metrics-chip ${daysLocal === d ? "active" : ""}`}
                onClick={() => setDaysLocal(d)}
              >
                {d}d
              </button>
            ))}
          </div>
        )}
        <button className="fw-metrics-export" onClick={exportJsonl}>
          Export JSONL
        </button>
        {showPopout && (
          <button
            className="fw-metrics-export"
            onClick={() => void openUsageWindow()}
            title="Abrir consumo geral em janela separada"
          >
            ⧉ Janela
          </button>
        )}
      </div>
      {exportStatus && <div className="fw-metrics-export-status">{exportStatus}</div>}

      {loading ? (
        <div className="fw-metrics-empty">Carregando métricas…</div>
      ) : rows.length === 0 ? (
        <div className="fw-metrics-empty">
          Métricas aparecem após o primeiro turno {scope === "session" ? "desta sessão" : "em qualquer sessão agent"} —
          cada turno grava comando, agente, modelo e tokens localmente.
        </div>
      ) : (
        <>
          <div className="fw-metrics-summary">
            {totalTurns} turnos · <strong>{formatCost(totalCost)}</strong>
            <span className="fw-metrics-period"> · últimos {days} dias</span>
          </div>

          <div className="fw-metrics-section">
            <div className="fw-metrics-title">Por comando</div>
            {commandAggs.map((c) => (
              <div
                key={c.command}
                className="fw-metrics-row"
                title={`${c.turns} turnos · média ${formatCost(c.avgCostUsd)} · ${formatTokens(c.outputTokens)} out · ${formatDuration(c.avgDurationMs)} médio`}
              >
                <span className="fw-metrics-label mono">/{c.command}</span>
                <div className="fw-metrics-track">
                  <div
                    className="fw-metrics-fill"
                    style={{ width: `${maxCommandCost > 0 ? (c.costUsd / maxCommandCost) * 100 : 0}%` }}
                  />
                </div>
                <span className="fw-metrics-value mono">
                  {formatCost(c.costUsd)} · {formatDuration(c.avgDurationMs)}
                </span>
              </div>
            ))}
          </div>

          {agentAggs.length > 0 && (
            <div className="fw-metrics-section">
              <div className="fw-metrics-title">Por agente (tokens totais)</div>
              {agentAggs.map((a) => (
                <div key={a.agent} className="fw-metrics-row" title={`${a.runs} execuções`}>
                  <span className="fw-metrics-label truncate">{a.agent.replace(/^harness-cmd:/, "")}</span>
                  <div className="fw-metrics-track">
                    <div
                      className="fw-metrics-fill fw-metrics-fill-agent"
                      style={{ width: `${maxAgentTokens > 0 ? (a.outputTokens / maxAgentTokens) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="fw-metrics-value mono">{formatTokens(a.outputTokens)}</span>
                </div>
              ))}
            </div>
          )}

          {modelAggs.length > 0 && (
            <div className="fw-metrics-section">
              <div className="fw-metrics-title">Por modelo</div>
              {modelAggs.map((m) => (
                <div key={m.model} className="fw-metrics-row" title={`${m.turns} turnos`}>
                  <span className="fw-metrics-label mono truncate">{m.model}</span>
                  <div className="fw-metrics-track">
                    <div
                      className="fw-metrics-fill fw-metrics-fill-model"
                      style={{ width: `${modelAggs[0].costUsd > 0 ? (m.costUsd / modelAggs[0].costUsd) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="fw-metrics-value mono">{formatCost(m.costUsd)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
