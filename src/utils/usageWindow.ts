/**
 * openUsageWindow — focus-or-create the standalone "Consumo Geral"
 * native window.  The window renders `src/windows/UsageWindow.tsx`
 * (selected by the `#/usage` hash in main.tsx) and reads ONLY from
 * SQLite via Tauri commands — no React state is shared between windows.
 */
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export const USAGE_WINDOW_LABEL = "usage";

export async function openUsageWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel(USAGE_WINDOW_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }
  new WebviewWindow(USAGE_WINDOW_LABEL, {
    url: "index.html#/usage",
    title: "Entry IDE — Consumo Geral",
    width: 760,
    height: 720,
    minWidth: 520,
    minHeight: 400,
  });
}
