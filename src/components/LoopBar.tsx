/**
 * LoopBar — loop-runner control pinned to the bottom of the agent pane
 * (above the consumption widget).
 *
 * Idle: a quiet "⟳ Loop" button opening the config popover (preset,
 * prompt, guardrails).  Running: iteration counter, spend vs ceiling,
 * and an always-visible stop button.  Finished: the stop reason and a
 * dismiss action.
 */
import "../styles/components/LoopBar.css";
import { useState, useSyncExternalStore } from "react";
import {
  clearLoop,
  getLoopsSnapshot,
  startLoop,
  stopLoop,
  subscribeLoops,
  type LoopState,
} from "../state/loopStore";
import { LOOP_DEFAULTS, LOOP_PRESETS } from "../utils/loopPresets";

function formatCost(n: number): string {
  if (n <= 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

export function LoopBar({ sessionId }: { sessionId: string }) {
  const loop = useSyncExternalStore(
    subscribeLoops,
    () => getLoopsSnapshot().get(sessionId) ?? null,
  );
  const [configOpen, setConfigOpen] = useState(false);

  if (loop && (loop.status === "running" || loop.status === "waiting")) {
    return <ActiveLoop sessionId={sessionId} loop={loop} />;
  }
  if (loop) {
    // done / stopped — show the reason until dismissed
    return (
      <div className={`loop-bar is-${loop.status}`} data-testid="loop-bar">
        <span className="loop-bar-icon" aria-hidden="true">⟳</span>
        <span className="loop-bar-status">
          {loop.status === "done" ? "Loop concluído" : "Loop parado"} · {loop.stopReason}
          {" "}· {loop.iteration} iteração(ões) · {formatCost(loop.spentUsd)}
        </span>
        <button type="button" className="loop-bar-btn" onClick={() => clearLoop(sessionId)}>
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="loop-bar is-idle" data-testid="loop-bar">
      <button
        type="button"
        className="loop-bar-btn loop-bar-open"
        onClick={() => setConfigOpen((v) => !v)}
        aria-expanded={configOpen}
        title="Executar um prompt em loop até condição de parada (com teto de custo)"
      >
        ⟳ Loop
      </button>
      {configOpen && (
        <LoopConfigPopover
          onStart={(config) => {
            if (startLoop(sessionId, config)) setConfigOpen(false);
          }}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </div>
  );
}

function ActiveLoop({ sessionId, loop }: { sessionId: string; loop: LoopState }) {
  return (
    <div className={`loop-bar is-${loop.status}`} data-testid="loop-bar">
      <span className="loop-bar-icon loop-bar-spin" aria-hidden="true">⟳</span>
      <span className="loop-bar-status">
        iteração {loop.iteration}/{loop.config.maxIterations}
        {" "}· {formatCost(loop.spentUsd)} / teto {formatCost(loop.config.costCeilingUsd)}
        {loop.status === "waiting" ? " · aguardando próxima iteração…" : " · rodando…"}
      </span>
      <button
        type="button"
        className="loop-bar-btn loop-bar-stop"
        onClick={() => stopLoop(sessionId)}
      >
        Parar
      </button>
    </div>
  );
}

function LoopConfigPopover({
  onStart,
  onClose,
}: {
  onStart: (config: Parameters<typeof startLoop>[1]) => void;
  onClose: () => void;
}) {
  const [presetId, setPresetId] = useState(LOOP_PRESETS[0].id);
  const [prompt, setPrompt] = useState(LOOP_PRESETS[0].prompt);
  const [maxIterations, setMaxIterations] = useState(LOOP_DEFAULTS.maxIterations);
  const [ceiling, setCeiling] = useState(LOOP_DEFAULTS.costCeilingUsd);

  const selectPreset = (id: string) => {
    setPresetId(id);
    const preset = LOOP_PRESETS.find((p) => p.id === id);
    if (preset && preset.id !== "custom") setPrompt(preset.prompt);
    if (preset?.id === "custom") setPrompt("");
  };

  const canStart = prompt.trim().length > 0 && maxIterations > 0 && ceiling > 0;

  return (
    <div className="loop-config" data-testid="loop-config">
      <div className="loop-config-row">
        <label>Preset</label>
        <select value={presetId} onChange={(e) => selectPreset(e.target.value)}>
          {LOOP_PRESETS.map((p) => (
            <option key={p.id} value={p.id} title={p.description}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className="loop-config-prompt"
        value={prompt}
        rows={4}
        placeholder="Prompt repetido a cada iteração…"
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div className="loop-config-row loop-config-guards">
        <label>
          Máx. iterações
          <input
            type="number"
            min={1}
            max={100}
            value={maxIterations}
            onChange={(e) => setMaxIterations(parseInt(e.target.value, 10) || 1)}
          />
        </label>
        <label>
          Teto de custo (US$)
          <input
            type="number"
            min={0.05}
            step={0.25}
            value={ceiling}
            onChange={(e) => setCeiling(parseFloat(e.target.value) || 0.05)}
          />
        </label>
      </div>
      <div className="loop-config-actions">
        <button type="button" className="loop-bar-btn" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="loop-bar-btn loop-bar-start"
          disabled={!canStart}
          onClick={() =>
            onStart({
              ...LOOP_DEFAULTS,
              prompt: prompt.trim(),
              maxIterations,
              costCeilingUsd: ceiling,
            })
          }
        >
          Iniciar loop
        </button>
      </div>
      <p className="loop-config-hint">
        O loop para sozinho no teto de custo, no máximo de iterações ou quando o
        agente responder <code>LOOP_DONE</code>.
      </p>
    </div>
  );
}
