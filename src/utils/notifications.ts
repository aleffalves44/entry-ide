import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

let permissionGranted = false;

export async function initNotifications(): Promise<void> {
  permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === "granted";
  }
}

export function notifyLongRunningDone(sessionLabel: string): void {
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

/**
 * The agent needs the user (permission request, AskUserQuestion,
 * ExitPlanMode).  Window unfocused → native notification (with the
 * system sound) so it cuts through other apps; focused → just the
 * chime, since the modal is already on screen somewhere.
 */
export function alertInteractionNeeded(toolName: string, sessionLabel?: string): void {
  const focused = typeof document !== "undefined" && document.hasFocus();
  playInteractionChime();
  if (focused) return;
  if (!permissionGranted) return;
  sendNotification({
    title: "Claude precisa de você",
    body: sessionLabel
      ? `"${sessionLabel}" aguarda aprovação: ${toolName}`
      : `Sessão aguarda aprovação: ${toolName}`,
    // macOS plays the default alert sound; harmlessly ignored elsewhere.
    sound: "default",
  });
}
