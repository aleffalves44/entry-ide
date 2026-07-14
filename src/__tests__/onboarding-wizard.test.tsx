// @vitest-environment jsdom
/**
 * OnboardingWizard — two-screen flow (welcome → privacy).
 *
 * Covers:
 *  - Exactly 2 steps rendered in order (welcome first, privacy second).
 *  - Finishing the wizard sets onboarding_completed.
 *  - Silent AI provider detection triggered on first launch.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { OnboardingWizard } from "../components/OnboardingWizard";

const mockGetSetting = vi.fn<() => Promise<string | null>>();
const mockSetSetting = vi.fn<() => Promise<void>>();
const mockCheckAiProviders = vi.fn<() => Promise<Record<string, boolean>>>();

vi.mock("../api/settings", () => ({
  getSetting: (...args: unknown[]) => mockGetSetting(...args),
  setSetting: (...args: unknown[]) => mockSetSetting(...args),
  getSettings: vi.fn(() => Promise.resolve({})),
}));

vi.mock("../api/sessions", () => ({
  checkAiProviders: (...args: unknown[]) => mockCheckAiProviders(...args),
}));

// OnboardingWizard imports a CSS file; vitest handles it via config (treated as
// empty module). No additional shim needed here.

beforeEach(() => {
  vi.clearAllMocks();
  mockSetSetting.mockResolvedValue(undefined);
  mockCheckAiProviders.mockResolvedValue({ claude: true });
});

afterEach(() => {
  cleanup();
});

describe("OnboardingWizard — two-screen flow", () => {
  it("does not render on a completed onboarding", async () => {
    mockGetSetting.mockResolvedValue("true");
    const { container } = render(<OnboardingWizard />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("renders the welcome step on first launch", async () => {
    mockGetSetting.mockRejectedValue(new Error("not found"));
    render(<OnboardingWizard />);
    await waitFor(() => {
      expect(screen.getByText("Entry IDE")).toBeDefined();
    });
  });

  it("renders exactly 2 progress dots", async () => {
    mockGetSetting.mockRejectedValue(new Error("not found"));
    const { container } = render(<OnboardingWizard />);
    await waitFor(() => {
      expect(screen.getByText("Entry IDE")).toBeDefined();
    });
    const dots = container.querySelectorAll(".onboarding-dot");
    expect(dots.length).toBe(2);
  });

  it("advances from welcome to privacy on Get Started click", async () => {
    mockGetSetting.mockRejectedValue(new Error("not found"));
    render(<OnboardingWizard />);
    await waitFor(() => {
      expect(screen.getByText("Get Started")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Get Started"));
    expect(screen.getByText("Privacy & Data")).toBeDefined();
    expect(screen.getByText("No telemetry")).toBeDefined();
  });

  it("privacy step shows settings hint", async () => {
    mockGetSetting.mockRejectedValue(new Error("not found"));
    render(<OnboardingWizard />);
    await waitFor(() => screen.getByText("Get Started"));
    fireEvent.click(screen.getByText("Get Started"));
    expect(screen.getByText(/Theme and AI tools can be configured anytime in Settings/)).toBeDefined();
  });

  it("finishing sets onboarding_completed to true", async () => {
    mockGetSetting.mockRejectedValue(new Error("not found"));
    render(<OnboardingWizard />);
    await waitFor(() => screen.getByText("Get Started"));
    fireEvent.click(screen.getByText("Get Started"));
    fireEvent.click(screen.getByText("Finish"));
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith("onboarding_completed", "true");
    });
  });

  it("calls checkAiProviders silently on first launch", async () => {
    mockGetSetting.mockRejectedValue(new Error("not found"));
    render(<OnboardingWizard />);
    await waitFor(() => {
      expect(mockCheckAiProviders).toHaveBeenCalledTimes(1);
    });
  });

  it("does NOT call checkAiProviders when onboarding already completed", async () => {
    mockGetSetting.mockResolvedValue("true");
    render(<OnboardingWizard />);
    // Give async effects time to settle
    await new Promise((r) => setTimeout(r, 50));
    expect(mockCheckAiProviders).not.toHaveBeenCalled();
  });

  it("Step type does not include theme or ai_setup (SSR smoke check)", () => {
    // The component only mounts when not completed; here we just verify that
    // the module exports a function and does not reference removed step names
    // at runtime (caught at TypeScript level — this is a runtime sanity check).
    expect(typeof OnboardingWizard).toBe("function");
    const src = OnboardingWizard.toString();
    expect(src).not.toContain('"theme"');
    expect(src).not.toContain('"ai_setup"');
  });
});
