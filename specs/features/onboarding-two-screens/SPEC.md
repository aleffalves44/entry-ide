# SPEC: onboarding-two-screens

## Context

First-launch onboarding (`src/components/OnboardingWizard.tsx`) has 4 screens: `welcome → theme → ai_setup → privacy` (`type Step`, :8). Too long; theme and AI-tool setup duplicate what Settings already owns:
- Theme + UI scale: Settings `appearance` tab (`src/components/Settings.tsx:366`).
- AI providers: Settings `ai-agent` tab (`Settings.tsx:792`).
- Wizard visibility gated by `onboarding_completed` setting (`OnboardingWizard.tsx:45`); mounted at `src/App.tsx:1381`.
- `checkAiProviders()` currently runs inside the wizard's `ai_setup` step (:222).

Goal: onboarding ≤ 2 screens — Welcome → Permissions/Privacy. Theme and AI tools live in Settings only; AI provider detection happens silently (no dedicated onboarding screen).

## RIGID Requirements

R1. The onboarding wizard MUST have exactly 2 steps: `welcome` and `privacy` (permissions/privacy screen). The `theme` and `ai_setup` steps MUST be removed from the wizard flow and its `Step` type.

R2. AI provider detection (`checkAiProviders()`) MUST still run on first launch, silently (no dedicated screen, no blocking UI). Its results must reach the same destination they do today (whatever state/setting the current ai_setup step feeds) so the Settings `ai-agent` tab reflects detected providers.

R3. The `privacy` (second) screen MAY gain a single one-line pointer such as "Theme and AI tools can be configured anytime in Settings" — informative text only, no interactive setup controls.

R4. No loss of capability: theme + UI scale remain fully configurable in Settings `appearance`; AI tools remain fully configurable in Settings `ai-agent`. Do not modify those tabs beyond what R2 requires.

R5. Wizard completion semantics unchanged: `onboarding_completed` set on finish; wizard never re-shows after completion; default theme applies when user skips theme selection (previous default preserved).

R6. Dead code from removed steps (step components, step-only styles, unused imports) MUST be removed, not commented out.

R7. `npx tsc --noEmit` zero net-new errors on changed files; existing tests pass; tests cover: wizard renders exactly 2 steps in order, finishing sets completion, silent provider detection triggered on first launch.

## Acceptance Criteria (binary)

- AC1: First launch shows Welcome → Privacy/Permissions only (2 screens).
- AC2: AI provider detection runs silently on first launch; Settings `ai-agent` shows detected state.
- AC3: Theme/scale and AI tools remain configurable in Settings.
- AC4: `onboarding_completed` behavior unchanged.
- AC5: tsc net-zero + test suite green; no dead step code remains.

## Out of scope

Settings redesign, new permission prompts beyond what the current privacy screen shows, telemetry.
