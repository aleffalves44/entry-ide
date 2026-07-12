/**
 * openUsageWindow — focus-or-create the standalone "Consumo Geral"
 * native window.  The window renders `src/windows/UsageWindow.tsx`
 * (selected by the `#/usage` hash in main.tsx) and reads ONLY from
 * SQLite via Tauri commands — no React state is shared between windows.
 */
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { message } from "@tauri-apps/plugin-dialog";

export const USAGE_WINDOW_LABEL = "usage";

export async function openUsageWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel(USAGE_WINDOW_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }
  const win = new WebviewWindow(USAGE_WINDOW_LABEL, {
    url: "index.html#/usage",
    title: "Entry IDE — Consumo Geral",
    width: 760,
    height: 720,
    minWidth: 520,
    minHeight: 400,
  });
  // Creation is async — a capability/permission problem would otherwise
  // fail in silence and the user just sees "nothing happened".
  void win.once("tauri://error", (e) => {
    console.error("[usageWindow] window creation failed:", e.payload);
    void message(
      `Não foi possível abrir a janela de consumo:\n${JSON.stringify(e.payload)}`,
      { title: "Consumo Geral", kind: "error" },
    );
  });
}
