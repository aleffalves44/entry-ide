/**
 * i18n layer — dictionary integrity (RIGID R5), interpolation, and the
 * locale store's switch/persist behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// api/settings reaches Tauri at module load; stub the two functions the
// locale store uses.
const setSettingMock = vi.fn(async () => {});
let getSettingMock = vi.fn(async (_key: string): Promise<string> => "");
vi.mock("../api/settings", () => ({
  setSetting: (key: string, value: string) => setSettingMock(key, value),
  getSetting: (key: string) => getSettingMock(key),
}));

import { en } from "../i18n/en";
import { ptBR } from "../i18n/ptBR";
import { translate, dictionaries, isLocale, DEFAULT_LOCALE, LOCALES } from "../i18n";

describe("dictionary key-completeness (R5)", () => {
  it("en and pt-BR expose exactly the same key set", () => {
    const enKeys = Object.keys(en).sort();
    const ptKeys = Object.keys(ptBR).sort();
    expect(ptKeys).toEqual(enKeys);
  });

  it("no value is empty in either locale", () => {
    for (const dict of Object.values(dictionaries)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value, `empty value for ${key}`).not.toBe("");
      }
    }
  });

  it("placeholders match across locales for every key", () => {
    const placeholders = (s: string) =>
      (s.match(/\{(\w+)\}/g) ?? []).sort().join(",");
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(ptBR[key]), `placeholder mismatch for ${key}`).toBe(
        placeholders(en[key]),
      );
    }
  });

  it("exposes en as default and both locales", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALES).toEqual(["en", "pt-BR"]);
  });
});

describe("translate", () => {
  it("returns the raw template when no vars are given", () => {
    expect(translate(en, "common.send")).toBe("Send");
  });

  it("fills named placeholders from vars", () => {
    expect(translate(en, "loop.iterationProgress", { current: 2, max: 5 })).toBe(
      "iteration 2/5",
    );
    expect(translate(ptBR, "loop.iterationProgress", { current: 2, max: 5 })).toBe(
      "iteração 2/5",
    );
  });

  it("leaves unknown placeholders intact rather than blanking them", () => {
    expect(translate(en, "status.updateTo", {})).toBe("Update to v{version}");
  });

  it("falls back to the key when it is missing (never throws)", () => {
    const sparse = {} as Record<keyof typeof en, string>;
    expect(translate(sparse, "common.send")).toBe("common.send");
  });
});

describe("isLocale", () => {
  it("accepts supported locales and rejects everything else", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("pt-BR")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("localeStore", () => {
  beforeEach(() => {
    setSettingMock.mockClear();
    getSettingMock = vi.fn(async () => "");
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetModules();
  });

  it("defaults to en and switches + persists on setLocale", async () => {
    const store = await import("../state/localeStore");
    expect(store.getLocale()).toBe("en");

    const seen: string[] = [];
    const unsub = store.subscribeLocale(() => seen.push(store.getLocale()));
    store.setLocale("pt-BR");
    expect(store.getLocale()).toBe("pt-BR");
    expect(seen).toEqual(["pt-BR"]);
    expect(setSettingMock).toHaveBeenCalledWith("locale", "pt-BR");

    // No-op when unchanged.
    store.setLocale("pt-BR");
    expect(seen).toHaveLength(1);
    unsub();
  });

  it("initLocale adopts a valid persisted locale, ignores junk", async () => {
    getSettingMock = vi.fn(async () => "pt-BR");
    const store = await import("../state/localeStore");
    await store.initLocale();
    expect(store.getLocale()).toBe("pt-BR");

    // Second call is idempotent (does not re-read).
    getSettingMock = vi.fn(async () => "en");
    await store.initLocale();
    expect(store.getLocale()).toBe("pt-BR");
  });

  it("initLocale keeps the default when the saved value is invalid", async () => {
    getSettingMock = vi.fn(async () => "klingon");
    const store = await import("../state/localeStore");
    await store.initLocale();
    expect(store.getLocale()).toBe("en");
  });
});
