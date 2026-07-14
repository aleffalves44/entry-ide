import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { getSetting, setSetting } from "../api/settings";
import { isMac, isWin } from "./platform";

let permissionGranted = false;

// ─── Global mute (pause notifications) ───────────────────────────────
// Silences EVERY audible/native alert (interaction chime, native
// banners, long-running-done).  Persisted so it survives restarts.
// Tiny external store so the StatusBar button re-renders on toggle.
let muted = false;
const muteListeners = new Set<() => void>();

export function areNotificationsMuted(): boolean {
  return muted;
}

export function setNotificationsMuted(value: boolean): void {
  if (muted === value) return;
  muted = value;
  setSetting("notifications_muted", value ? "1" : "0").catch(() => undefined);
  for (const fn of muteListeners) fn();
}

export function subscribeNotificationsMuted(fn: () => void): () => void {
  muteListeners.add(fn);
  return () => {
    muteListeners.delete(fn);
  };
}

export async function initNotifications(): Promise<void> {
  getSetting("notifications_muted")
    .then((v) => {
      if (v === "1") {
        muted = true;
        for (const fn of muteListeners) fn();
      }
    })
    .catch(() => undefined);
  permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === "granted";
  }
}

export function notifyLongRunningDone(sessionLabel: string): void {
  if (muted) return;
  if (!permissionGranted) return;
  sendNotification({
    title: "Task completed",
    body: `"${sessionLabel}" has returned to idle.`,
  });
}

/** Short two-tone chime via WebAudio — no asset, no dependency.  Used
 *  when the agent needs interaction and the window is already focused
 *  (a native notification would be noise, but an audible cue still
 *  helps with many panes open).  Silent failure on any audio error. */
export function playInteractionChime(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // Autoplay policies can hand out a suspended context (varies by
    // webview/platform) — resume unconditionally; by the time an agent
    // asks for permission the user has long since interacted.
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    gain.connect(ctx.destination);
    for (const [freq, at] of [[880, 0], [1174.66, 0.12]] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.15);
    }
    // Let the tail play out, then release the context.
    setTimeout(() => void ctx.close().catch(() => undefined), 500);
  } catch {
    /* audio unavailable — stay silent */
  }
}

/** Per-platform sound identifier for native notifications.  The WebAudio
 *  chime is the GUARANTEED audible cue on every platform (it plays even
 *  when the window is unfocused); the native sound is best-effort:
 *    macOS   — system alert sound name ("Ping" ships with every macOS)
 *    Windows — ms-winsoundevent toast audio id
 *    Linux   — freedesktop sound-theme event id (daemon support varies)
 */
function nativeNotificationSound(): string {
  if (isMac) return "Ping";
  if (isWin) return "ms-winsoundevent:Notification.Default";
  return "message-new-instant";
}

/**
 * The agent needs the user (permission request, AskUserQuestion,
 * ExitPlanMode).  Window unfocused → native notification (with the
 * system sound) so it cuts through other apps; focused → just the
 * chime, since the modal is already on screen somewhere.
 */
export function alertInteractionNeeded(toolName: string, sessionLabel?: string): void {
  if (muted) return;
  const focused = typeof document !== "undefined" && document.hasFocus();
  playInteractionChime();
  if (focused) return;
  if (!permissionGranted) return;
  sendNotification({
    title: "Claude precisa de você",
    body: sessionLabel
      ? `"${sessionLabel}" aguarda aprovação: ${toolName}`
      : `Sessão aguarda aprovação: ${toolName}`,
    sound: nativeNotificationSound(),
  });
}
