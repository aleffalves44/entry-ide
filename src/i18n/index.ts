/**
 * In-repo i18n layer — dictionary lookup + `{name}` interpolation, no
 * external dependency. Consumers use the `useTranslation` hook; pure code
 * (utilities, tests) can call `translate(...)` directly.
 */
import { en, type MessageKey } from "./en";
import { ptBR } from "./ptBR";
import type { Locale } from "./locale";

export type { Dict, MessageKey } from "./en";
export type { Locale } from "./locale";
export { LOCALES, DEFAULT_LOCALE, LOCALE_LABELS, isLocale } from "./locale";

/** Values allowed as interpolation arguments. */
export type TVars = Record<string, string | number>;

/** The translate function surface exposed to components and pure helpers. */
export type TFunction = (key: MessageKey, vars?: TVars) => string;

export const dictionaries: Record<Locale, Record<MessageKey, string>> = {
  en,
  "pt-BR": ptBR,
};

/**
 * Resolve `key` in `dict` and fill `{name}` placeholders from `vars`.
 * Falls back to the key itself if it is missing (never throws), and leaves
 * unknown `{placeholders}` intact so the gap is visible rather than silent.
 */
export function translate(
  dict: Record<MessageKey, string>,
  key: MessageKey,
  vars?: TVars,
): string {
  const template = dict[key] ?? (key as string);
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
