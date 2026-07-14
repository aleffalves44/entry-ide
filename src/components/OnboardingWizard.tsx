import "../styles/components/OnboardingWizard.css";
import { useState, useEffect, useCallback } from "react";
import { getSetting, setSetting } from "../api/settings";
import { checkAiProviders } from "../api/sessions";

type Step = "welcome" | "privacy";

const STEPS: Step[] = ["welcome", "privacy"];

const SETTING_KEY = "onboarding_completed";

export function OnboardingWizard() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>("welcome");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const val = await getSetting(SETTING_KEY);
        if (cancelled) return;
        if (val === "true") return; // already completed
      } catch {
        // Setting doesn't exist yet — first launch
      }
      if (!cancelled) {
        setVisible(true);
        // R2: run provider detection fire-and-forget on first launch so any
        // backend caching side-effects still occur. Results are not stored
        // here — the Settings ai-agent tab calls checkAiProviders() on its
        // own mount and owns the display of detected state.
        checkAiProviders().catch((e) => console.warn("[onboarding] provider detection failed:", e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const currentStepIdx = STEPS.indexOf(step);

  const goNext = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }, [step]);

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }, [step]);

  const handleFinish = useCallback(async () => {
    await setSetting(SETTING_KEY, "true").catch(console.warn);
    setVisible(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (step === "welcome") goNext();
      else if (step === "privacy") handleFinish();
    }
  }, [step, goNext, handleFinish]);

  if (!visible) return null;

  return (
    <div className="onboarding-backdrop" onKeyDown={handleKeyDown}>
      <div className="onboarding-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header — hidden on welcome step */}
        {step !== "welcome" && (
          <div className="onboarding-header">
            <span className="onboarding-header-title">Privacy &amp; Data</span>
            <span className="onboarding-header-step">
              Step {currentStepIdx + 1} of {STEPS.length}
            </span>
          </div>
        )}

        {/* Body */}
        <div className="onboarding-body">
          {/* ── Step 1: Welcome ── */}
          {step === "welcome" && (
            <div className="onboarding-welcome">
              <div className="onboarding-logo">Entry IDE</div>
              <p className="onboarding-tagline">
                AI-powered terminal emulator for developers. Wrap your existing
                shell with AI superpowers — ghost-text suggestions, prompt
                composer, git management, file explorer, and cost tracking.
              </p>
              <span className="onboarding-early-access">
                Free
              </span>
            </div>
          )}

          {/* ── Step 2: Privacy ── */}
          {step === "privacy" && (
            <>
              <div className="onboarding-privacy-section">
                <div className="onboarding-privacy-section-title">
                  No telemetry
                </div>
                <ul className="onboarding-privacy-list never">
                  <li>Entry IDE does not collect any usage analytics</li>
                  <li>Terminal content, commands, and files never leave your machine</li>
                  <li>AI requests go directly to your configured provider</li>
                </ul>
              </div>
              <p className="onboarding-settings-hint">
                Theme and AI tools can be configured anytime in Settings.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="onboarding-footer">
          <div className="onboarding-dots">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`onboarding-dot ${i <= currentStepIdx ? "active" : ""}`}
              />
            ))}
          </div>
          <div className="onboarding-actions">
            {step === "welcome" && (
              <button
                className="onboarding-btn onboarding-btn-primary"
                onClick={goNext}
              >
                Get Started
              </button>
            )}
            {step === "privacy" && (
              <>
                <button className="onboarding-btn" onClick={goBack}>
                  Back
                </button>
                <button
                  className="onboarding-btn onboarding-btn-primary"
                  onClick={handleFinish}
                >
                  Finish
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
