/**
 * localeStore — the active UI locale as a tiny external store.
 *
 * Not held in SessionContext on purpose: the standalone usage window
 * (src/windows/UsageWindow.tsx) mounts locale-aware components WITHOUT the
 * SessionProvider, so a context-backed locale would crash there. A plain
 * `useSyncExternalStore` source works in every window and re-renders
 * subscribers immediately on change — same pattern as `loopStore` and the
 * notifications-muted toggle.
 *
 * Persistence rides the existing settings table (`locale` key). Default is
 * English until `initLocale()` reads the saved value.
 */
import { getSetting, setSetting } from "../api/settings";
import { DEFAULT_LOCALE, isLocale, type Locale } from "../i18n";

let current: Locale = DEFAULT_LOCALE;
let loaded = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

/** Current locale snapshot (also serves as the SSR snapshot). */
export function getLocale(): Locale {
  return current;
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Change the active locale and persist it. No-op if unchanged. Re-renders
 * every subscriber synchronously; the settings write is fire-and-forget.
 */
export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  notify();
  setSetting("locale", locale).catch((e) =>
    console.error("[localeStore] failed to persist locale:", e),
  );
}

/**
 * Load the persisted locale once at app/window startup. Idempotent. Does not
 * write back — a fresh install (no saved value) stays on the default.
 */
export async function initLocale(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const saved = await getSetting("locale");
    if (isLocale(saved) && saved !== current) {
      current = saved;
      notify();
    }
  } catch (e) {
    console.error("[localeStore] failed to load locale:", e);
  }
}

/** Test-only: reset module state between cases. */
export function __resetLocaleForTests(locale: Locale = DEFAULT_LOCALE): void {
  current = locale;
  loaded = false;
  listeners.clear();
}
