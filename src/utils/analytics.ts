// Telemetry removed — all tracking functions are intentional no-ops.
export async function initAnalytics(): Promise<void> {}

export function setAnalyticsEnabled(_value: boolean): void {}

function track(_name: string, _props?: Record<string, string | number>): void {}

export function trackAppStarted(): void {
  track("app_started");
}

export function trackSessionCreated(props: {
  execution_mode: string;
  has_ai_provider: boolean;
}): void {
  track("session_created", {
    execution_mode: props.execution_mode,
    has_ai_provider: props.has_ai_provider ? 1 : 0,
  });
}

export function trackFeatureUsed(feature: string): void {
  track("feature_used", { feature });
}
