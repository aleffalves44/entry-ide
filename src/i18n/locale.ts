/**
 * Locale identifiers for the in-repo i18n layer.
 *
 * English is the default and the source-of-truth dictionary; pt-BR is the
 * alternate. Kept free of React so it can be imported by pure utilities and
 * the Rust-backed settings bootstrap alike.
 */

export type Locale = "en" | "pt-BR";

/** All locales the UI can switch between, in menu order. */
export const LOCALES: readonly Locale[] = ["en", "pt-BR"];

/** Locale used on a fresh install (no saved setting). */
export const DEFAULT_LOCALE: Locale = "en";

/** Narrow an arbitrary string (e.g. a persisted setting) to a Locale. */
export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "pt-BR";
}

/** Human-readable label for the locale picker. Native names, not translated. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  "pt-BR": "Português (Brasil)",
};
