import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initLocale } from "./state/localeStore";
import "./styles/tokens.css";
import "./styles/base.css";

// Load the saved UI locale before first paint. Runs in every window
// (including the standalone usage window, which has no SessionProvider);
// idempotent, so the SessionProvider's own call is a no-op.
void initLocale();

// Dev-only debug hook: expose Tauri's `emit` on window so console tests
// can inject synthetic events (e.g. a `prompt is too long` result event
// to manually exercise the error banner) without needing the
// `withGlobalTauri` config or chasing Vite's resolved-deps path.  Lives
// behind `import.meta.env.DEV` so production builds never carry it.
if (import.meta.env.DEV) {
  import("@tauri-apps/api/event").then(({ emit, listen }) => {
    (window as unknown as { __entry?: unknown }).__entry = { emit, listen };
    // Console-discoverability: log once on boot so devs know it's there.
    // eslint-disable-next-line no-console
    console.info(
      "[entry-dev] window.__entry = { emit, listen } available for console testing",
    );
  });
}

// Secondary native windows share this bundle and select their root
// component by hash (see src/utils/usageWindow.ts).  They deliberately
// do NOT mount <App/> — no SessionContext, no PTYs, just SQLite reads.
const isUsageWindow = window.location.hash.startsWith("#/usage");

const LazyUsageWindow = React.lazy(() =>
  import("./windows/UsageWindow").then((m) => ({ default: m.UsageWindow })),
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isUsageWindow ? (
      <React.Suspense fallback={null}>
        <LazyUsageWindow />
      </React.Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
