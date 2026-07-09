import * as cmState from "@codemirror/state";
import * as cmView from "@codemirror/view";
import * as cmLanguage from "@codemirror/language";
import * as lezerHighlight from "@lezer/highlight";

declare global {
  interface Window {
    __entryCM?: {
      state: typeof cmState;
      view: typeof cmView;
      language: typeof cmLanguage;
      highlight: typeof lezerHighlight;
    };
  }
}

/**
 * Exposes CodeMirror core modules on `window.__entryCM` so that
 * plugins can access them without bundling their own copies.
 *
 * Call once at app startup.
 */
export function exposeCodeMirror(): void {
  window.__entryCM = {
    state: cmState,
    view: cmView,
    language: cmLanguage,
    highlight: lezerHighlight,
  };
}
