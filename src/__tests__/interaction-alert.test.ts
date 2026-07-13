// @vitest-environment jsdom
/**
 * alertInteractionNeeded — sound/notification when the agent blocks on
 * the user (permission request / AskUserQuestion / ExitPlanMode).
 *
 * Contract: focused window → chime only (modal is on screen); unfocused
 * → native notification with the system sound (plus chime).  Audio
 * failures are silent — the alert must never crash the event stream.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendNotificationMock = vi.fn();
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(() => Promise.resolve(true)),
  requestPermission: vi.fn(() => Promise.resolve("granted")),
  sendNotification: (...args: unknown[]) => sendNotificationMock(...args),
}));

import {
  alertInteractionNeeded,
  initNotifications,
} from "../utils/notifications";

describe("alertInteractionNeeded", () => {
  beforeEach(async () => {
    sendNotificationMock.mockClear();
    await initNotifications(); // latches permissionGranted = true
  });
  afterEach(() => vi.restoreAllMocks());

  it("unfocused window → native notification with sound", () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    alertInteractionNeeded("Bash", "checkout-fix");
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    const arg = sendNotificationMock.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.body).toContain("Bash");
    expect(arg.body).toContain("checkout-fix");
    expect(arg.sound).toBe("default");
  });

  it("focused window → no native notification (chime only)", () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    alertInteractionNeeded("AskUserQuestion");
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("never throws when audio is unavailable (jsdom has no AudioContext)", () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    expect(() => alertInteractionNeeded("ExitPlanMode")).not.toThrow();
  });
});
