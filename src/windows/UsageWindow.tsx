/**
 * UsageWindow — standalone "Consumo Geral" native window (M4).
 *
 * Thin window-chrome wrapper around ConsumptionView: geometry
 * persistence (usage_window_* settings), always-on-top pin, and
 * reopen-on-launch bookkeeping.  Focusing a session crosses windows via
 * the `entry://focus-session` event.  The docked twin lives in the
 * Workbench "Consumo" tab.
 */
import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getSettings, getSetting, setSetting } from "../api/settings";
import { restorePrefixedWindowState } from "../utils/windowState";
import { ConsumptionView } from "../components/ConsumptionView";

export function UsageWindow() {
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

  const focusSession = async (sessionId: string) => {
    await emit("entry://focus-session", { sessionId });
    const main = await WebviewWindow.getByLabel("main");
    await main?.setFocus();
  };

  return (
    <ConsumptionView
      onFocusSession={(id) => void focusSession(id)}
      headerExtra={
        <button
          type="button"
          className={`usage-window-pin${pinned ? " is-pinned" : ""}`}
          onClick={togglePin}
          title={pinned ? "Desafixar (deixa de ficar sobre as outras janelas)" : "Fixar sempre visível (always on top)"}
          aria-pressed={pinned}
        >
          📌
        </button>
      }
    />
  );
}
