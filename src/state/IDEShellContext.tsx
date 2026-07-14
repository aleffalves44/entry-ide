/**
 * IDEShellContext — thin context for top-level IDE shell callbacks that
 * need to reach deeply nested pane components without prop-drilling.
 *
 * Currently carries:
 *   onOpenSettings(tab) — open the Settings overlay at a specific tab.
 *
 * Intentionally kept minimal: only callbacks that pane components
 * legitimately need but cannot obtain from SessionContext.
 */
import { createContext, useContext } from "react";

export interface IDEShellCallbacks {
  /** Open the Settings overlay at the given tab name. */
  onOpenSettings: (tab: string) => void;
}

export const IDEShellContext = createContext<IDEShellCallbacks | null>(null);

/** Returns the shell callbacks if available.  Returns null when rendered
 *  outside the provider (e.g. in tests that don't mount the full app). */
export function useIDEShell(): IDEShellCallbacks | null {
  return useContext(IDEShellContext);
}
