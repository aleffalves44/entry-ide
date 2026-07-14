/**
 * useTranslation — component-facing i18n hook.
 *
 * Reads the active locale from `localeStore` via `useSyncExternalStore` (so a
 * locale change re-renders every consumer, in any window) and returns a
 * memoized `t(key, vars?)` bound to that locale's dictionary, plus the raw
 * `locale`.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getLocale, subscribeLocale } from "../state/localeStore";
import { dictionaries, translate, type Locale, type MessageKey, type TVars } from "../i18n";

export interface Translation {
  t: (key: MessageKey, vars?: TVars) => string;
  locale: Locale;
}

export function useTranslation(): Translation {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const dict = useMemo(() => dictionaries[locale], [locale]);
  const t = useCallback(
    (key: MessageKey, vars?: TVars) => translate(dict, key, vars),
    [dict],
  );
  return { t, locale };
}
