/**
 * SessionUsageWidget — collapsed one-line consumption readout pinned to
 * the bottom of the agent pane; expands into per-agent and per-model
 * breakdowns of THIS session's framework_usage rows.
 *
 * Renders nothing until the session has recorded usage, so fresh
 * sessions carry no extra chrome.
 */
import "../styles/components/SessionUsageWidget.css";
import { useState } from "react";
import { useSessionUsage } from "../hooks/useSessionUsage";
import { formatTokens } from "../utils/frameworkAggregates";

function formatCost(n: number): string {
  if (n <= 0) return "$0";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

export function SessionUsageWidget({ sessionId }: { sessionId: string }) {
  const usage = useSessionUsage(sessionId);
  const [expanded, setExpanded] = useState(false);

  if (usage.rows.length === 0) return null;

  return (
    <div className="session-usage" data-testid="session-usage">
      <button
        type="button"
        className="session-usage-bar"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="session-usage-caret" aria-hidden="true">
          {expanded ? "▾" : "▸"}
        </span>
        <span className="session-usage-tag">CONSUMO</span>
        <span className="session-usage-totals">
          {formatTokens(usage.totalTokens)} tokens · {formatCost(usage.totalCostUsd)}
        </span>
      </button>

      {expanded && (
        <div className="session-usage-detail" data-testid="session-usage-detail">
          {usage.byCommand.length > 0 && (
            <table className="session-usage-table">
              <thead>
                <tr>
                  <th>Comando</th>
                  <th>Turnos</th>
                  <th>Tokens (out)</th>
                  <th>Custo</th>
                </tr>
              </thead>
              <tbody>
                {usage.byCommand.map((c) => (
                  <tr key={c.command}>
                    <td>{c.command}</td>
                    <td>{c.turns}</td>
                    <td>{formatTokens(c.outputTokens)}</td>
                    <td>{formatCost(c.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {usage.byAgent.length > 0 && (
            <table className="session-usage-table">
              <thead>
                <tr>
                  <th>Agente</th>
                  <th>Execuções</th>
                  <th>Tokens (out)</th>
                  <th>Custo</th>
                </tr>
              </thead>
              <tbody>
                {usage.byAgent.map((a) => (
                  <tr key={a.agent}>
                    <td>{a.agent}</td>
                    <td>{a.runs}</td>
                    <td>{formatTokens(a.outputTokens)}</td>
                    <td>{formatCost(a.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {usage.byModel.length > 0 && (
            <table className="session-usage-table">
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Turnos</th>
                  <th>Tokens (out)</th>
                  <th>Custo</th>
                </tr>
              </thead>
              <tbody>
                {usage.byModel.map((m) => (
                  <tr key={m.model}>
                    <td>{m.model}</td>
                    <td>{m.turns}</td>
                    <td>{formatTokens(m.outputTokens)}</td>
                    <td>{formatCost(m.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
