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

/** Emitted when an agent session is waiting for a user decision (tool
 *  permission, AskUserQuestion, or plan approval) and the window is not
 *  focused.  Gives the user an ambient signal to return to the app. */
export function notifyPendingDecision(sessionLabel: string, toolName: string): void {
  if (!permissionGranted) return;
  sendNotification({
    title: "Decision needed",
    body: `"${sessionLabel}" — Claude is waiting for your input on: ${toolName}`,
  });
}
