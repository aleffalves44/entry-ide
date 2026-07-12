import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize, LogicalPosition } from "@tauri-apps/api/dpi";
import { setSetting } from "../api/settings";

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Restore saved window size/position from settings, then start tracking changes. */
export async function restoreWindowState(settings: Record<string, string>): Promise<void> {
  return restorePrefixedWindowState(settings, "window", { minW: 600, minH: 400 });
}

/**
 * Prefix-aware variant so secondary windows (e.g. the Consumo Geral
 * window, prefix "usage_window") persist their own geometry under
 * `<prefix>_width/_height/_x/_y` without colliding with the main window.
 */
export async function restorePrefixedWindowState(
  settings: Record<string, string>,
  prefix: string,
  opts?: { minW?: number; minH?: number },
): Promise<void> {
  const win = getCurrentWindow();

  const rawW = parseInt(settings[`${prefix}_width`] || "", 10);
  const rawH = parseInt(settings[`${prefix}_height`] || "", 10);
  const x = parseInt(settings[`${prefix}_x`] || "", 10);
  const y = parseInt(settings[`${prefix}_y`] || "", 10);

  if (rawW > 0 && rawH > 0) {
    const w = Math.max(rawW, opts?.minW ?? 400);
    const h = Math.max(rawH, opts?.minH ?? 300);
    await win.setSize(new LogicalSize(w, h));
  }
  if (!isNaN(x) && !isNaN(y)) {
    await win.setPosition(new LogicalPosition(x, y));
  }

  startTracking(prefix);
}

function startTracking(prefix: string): void {
  const win = getCurrentWindow();

  const save = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const size = await win.innerSize();
        const pos = await win.outerPosition();
        const factor = await win.scaleFactor();
        // Convert physical to logical
        const lw = Math.round(size.width / factor);
        const lh = Math.round(size.height / factor);
        const lx = Math.round(pos.x / factor);
        const ly = Math.round(pos.y / factor);

        setSetting(`${prefix}_width`, String(lw)).catch(() => {});
        setSetting(`${prefix}_height`, String(lh)).catch(() => {});
        setSetting(`${prefix}_x`, String(lx)).catch(() => {});
        setSetting(`${prefix}_y`, String(ly)).catch(() => {});
      } catch {
        /* window may be closing */
      }
    }, 500);
  };

  win.onResized(save);
  win.onMoved(save);
}
