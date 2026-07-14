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
import { useTranslation } from "../hooks/useTranslation";

function formatCost(n: number): string {
  if (n <= 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

export function LoopBar({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
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
          {loop.status === "done" ? t("loop.doneLabel") : t("loop.stoppedLabel")} · {loop.stopReason}
          {" "}· {t("loop.iterations", { count: loop.iteration })} · {formatCost(loop.spentUsd)}
        </span>
        <button type="button" className="loop-bar-btn" onClick={() => clearLoop(sessionId)}>
          {t("common.close")}
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
        title={t("loop.idleTitle")}
      >
        {t("loop.idleButton")}
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
  const { t } = useTranslation();
  return (
    <div className={`loop-bar is-${loop.status}`} data-testid="loop-bar">
      <span className="loop-bar-icon loop-bar-spin" aria-hidden="true">⟳</span>
      <span className="loop-bar-status">
        {t("loop.iterationProgress", { current: loop.iteration, max: loop.config.maxIterations })}
        {" · "}
        {t("loop.spendOfCap", {
          spent: formatCost(loop.spentUsd),
          ceiling: formatCost(loop.config.costCeilingUsd),
        })}
        {" · "}
        {loop.status === "waiting" ? t("loop.waiting") : t("loop.running")}
      </span>
      <button
        type="button"
        className="loop-bar-btn loop-bar-stop"
        onClick={() => stopLoop(sessionId)}
      >
        {t("loop.stop")}
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
  const { t } = useTranslation();
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
        <label>{t("loop.preset")}</label>
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
        placeholder={t("loop.promptPlaceholder")}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div className="loop-config-row loop-config-guards">
        <label>
          {t("loop.maxIterations")}
          <input
            type="number"
            min={1}
            max={100}
            value={maxIterations}
            onChange={(e) => setMaxIterations(parseInt(e.target.value, 10) || 1)}
          />
        </label>
        <label>
          {t("loop.costCeiling")}
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
          {t("common.cancel")}
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
          {t("loop.start")}
        </button>
      </div>
      <p className="loop-config-hint">
        {t("loop.hint")}
        <code>LOOP_DONE</code>.
      </p>
    </div>
  );
}
