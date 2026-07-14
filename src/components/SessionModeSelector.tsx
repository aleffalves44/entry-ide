/**
 * SessionModeSelector — active-session mode switcher (SPEC: session-mode-selector).
 *
 * Renders a radio-group with three options:  Agent · Terminal · SSH.
 * SSH is always disabled for live conversion (not yet supported; R3/R4).
 * Agent is disabled when the session's ai_provider is not "claude" (R4).
 *
 * The component intentionally does NOT contain the confirmation dialog —
 * that lives in SplitPane (existing `pendingModeConvert` flow) so the
 * destructive-action warning is presented once, not duplicated.
 */
import "../styles/components/SessionModeSelector.css";
import { useCallback, useRef, KeyboardEvent } from "react";
import { SessionMode } from "../types/session";
import { SessionData } from "../types/session";

export type SelectorMode = "agent" | "terminal" | "ssh";

interface ModeOption {
  id: SelectorMode;
  label: string;
  description: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    id: "agent",
    label: "Agent",
    description: "AI conversation with tools, diffs and approvals.",
  },
  {
    id: "terminal",
    label: "Terminal",
    description: "Classic shell — full PTY, any command.",
  },
  {
    id: "ssh",
    label: "SSH",
    description: "Remote shell on another machine.",
  },
];

/** Derive the selector's view of the active mode from the raw SessionData. */
export function resolveDisplayMode(session: SessionData): SelectorMode {
  if (session.ssh_info) return "ssh";
  return session.mode as SelectorMode;
}

interface SessionModeSelectorProps {
  session: SessionData;
  /** Called when the user requests a mode switch.
   *  The parent (SplitPane) must present the confirmation dialog and then
   *  call convertSessionMode.  SSH is never passed here (it stays disabled). */
  onRequestConvert: (newMode: SessionMode) => void;
}

export function SessionModeSelector({
  session,
  onRequestConvert,
}: SessionModeSelectorProps) {
  const activeDisplayMode = resolveDisplayMode(session);
  const groupRef = useRef<HTMLDivElement>(null);

  const isAgentDisabled = session.ai_provider !== "claude";
  const isSSHDisabled = true; // conversion not supported in 1.0.0

  function isOptionDisabled(id: SelectorMode): boolean {
    if (activeDisplayMode === "ssh" && id !== "ssh") return true;
    if (id === "agent") return isAgentDisabled;
    if (id === "ssh") return isSSHDisabled;
    return false;
  }

  function getDisabledTooltip(id: SelectorMode): string | undefined {
    if (id === "agent" && isAgentDisabled) {
      return `Agent mode requires Claude (current provider: ${session.ai_provider ?? "none"})`;
    }
    if (id === "ssh") {
      return "Available for new sessions";
    }
    return undefined;
  }

  const handleSelect = useCallback(
    (id: SelectorMode) => {
      if (isOptionDisabled(id)) return;
      if (id === activeDisplayMode) return;
      // SSH sessions (terminal mode with ssh_info) can only switch to agent
      // if the provider is claude. Switching "terminal" means the base mode.
      onRequestConvert(id as SessionMode);
    },
    [activeDisplayMode, onRequestConvert, isAgentDisabled],
  );

  // Arrow-key navigation within radiogroup (R6)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const options = MODE_OPTIONS.map((o) => o.id);
      const currentIndex = options.indexOf(activeDisplayMode);
      let nextIndex = currentIndex;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        // Find next non-disabled option
        let i = currentIndex;
        do {
          i = (i + 1) % options.length;
        } while (isOptionDisabled(options[i]) && i !== currentIndex);
        nextIndex = i;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        let i = currentIndex;
        do {
          i = (i - 1 + options.length) % options.length;
        } while (isOptionDisabled(options[i]) && i !== currentIndex);
        nextIndex = i;
      } else {
        return;
      }

      if (nextIndex !== currentIndex) {
        handleSelect(options[nextIndex]);
        // Move DOM focus to the newly active radio button.
        // nextIndex is an index into MODE_OPTIONS (0-2); the NodeList only
        // contains enabled radios, so map to that subset first.
        const enabledOptions = MODE_OPTIONS.filter((o) => !isOptionDisabled(o.id));
        const enabledPos = enabledOptions.findIndex((o) => o.id === MODE_OPTIONS[nextIndex].id);
        const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>(
          "[role='radio']:not([aria-disabled='true'])",
        );
        buttons?.[enabledPos]?.focus();
      }
    },
    [activeDisplayMode, handleSelect],
  );

  const activeOption = MODE_OPTIONS.find((o) => o.id === activeDisplayMode);

  return (
    <div className="session-mode-selector">
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Session mode"
        className="session-mode-selector-group"
        onKeyDown={handleKeyDown}
      >
        {MODE_OPTIONS.map((opt) => {
          const isActive = opt.id === activeDisplayMode;
          const disabled = isOptionDisabled(opt.id);
          const tooltip = getDisabledTooltip(opt.id);

          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-disabled={disabled || undefined}
              aria-label={opt.label}
              title={disabled ? tooltip : opt.label}
              tabIndex={isActive ? 0 : -1}
              className={[
                "session-mode-selector-option",
                isActive ? "is-active" : "",
                disabled ? "is-disabled" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleSelect(opt.id)}
              disabled={false} /* let aria-disabled drive UX; don't block focus */
            >
              <span
                className="session-mode-selector-dot"
                aria-hidden="true"
              >
                {isActive ? "●" : "○"}
              </span>
              <span className="session-mode-selector-label">{opt.label}</span>
            </button>
          );
        })}
      </div>
      {activeOption && (
        <span className="session-mode-selector-description" aria-live="polite">
          {activeOption.description}
        </span>
      )}
    </div>
  );
}
