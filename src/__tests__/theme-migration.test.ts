/**
 * Theme migration regression — v1.1.15.
 *
 * v1.1.15 consolidated 30 themes down to 8 (four dark, four light).  Every
 * dropped id is mapped to its nearest cousin via `LEGACY_THEME_MIGRATIONS`,
 * resolved on read by `normalizeThemeId`, and persisted back to settings on
 * first apply (see `applyTheme`).
 *
 * These tests pin the migration contract.  They exist because the mapping
 * was opinionated — "tron" → "phosphor", "midnight" → "observatory",
 * "amber" → "atelier", etc. — and a careless rebase could silently change
 * a stored user's theme to something tonally wrong.  Migrations are also
 * forever: an entry is never deleted, only added, so old `settings.json`
 * files keep working.
 *
 * Pure JS — no DOM, no Tauri runtime.
 */
import { describe, it, expect } from "vitest";
import {
  THEME_OPTIONS,
  LEGACY_THEME_MIGRATIONS,
  DEFAULT_THEME_ID,
  normalizeThemeId,
  wasThemeMigrated,
} from "../utils/themeManager";

const VALID_IDS = new Set(THEME_OPTIONS.map((t) => t.id));

describe("normalizeThemeId — legacy migrations resolve to current ids", () => {
  it("every entry in LEGACY_THEME_MIGRATIONS lands in the current catalog", () => {
    for (const legacyId of Object.keys(LEGACY_THEME_MIGRATIONS)) {
      const resolved = normalizeThemeId(legacyId);
      expect(
        VALID_IDS.has(resolved),
        `${legacyId} → ${resolved} (not in THEME_OPTIONS)`,
      ).toBe(true);
    }
  });

  it("is idempotent — normalizing twice is a no-op", () => {
    for (const legacyId of Object.keys(LEGACY_THEME_MIGRATIONS)) {
      const once = normalizeThemeId(legacyId);
      const twice = normalizeThemeId(once);
      expect(twice).toBe(once);
    }
    for (const t of THEME_OPTIONS) {
      expect(normalizeThemeId(normalizeThemeId(t.id))).toBe(t.id);
    }
  });

  it("returns DEFAULT_THEME_ID for empty / null / unknown inputs", () => {
    expect(normalizeThemeId("")).toBe(DEFAULT_THEME_ID);
    expect(normalizeThemeId(null)).toBe(DEFAULT_THEME_ID);
    expect(normalizeThemeId(undefined)).toBe(DEFAULT_THEME_ID);
    expect(normalizeThemeId("some-future-theme-id-we-dont-know")).toBe(
      DEFAULT_THEME_ID,
    );
  });

  it("passes every current theme id through unchanged", () => {
    for (const t of THEME_OPTIONS) {
      expect(normalizeThemeId(t.id)).toBe(t.id);
    }
  });
});

describe("wasThemeMigrated — true iff stored id is not in current catalog", () => {
  it("returns false for a current valid id", () => {
    expect(wasThemeMigrated("frosted-dark")).toBe(false);
  });

  it("returns true for a legacy id (will be migrated)", () => {
    expect(wasThemeMigrated("hacker")).toBe(true);
  });

  it("returns true for an unknown id (will fall back to default)", () => {
    expect(wasThemeMigrated("some-future-theme-id-we-dont-know")).toBe(true);
  });
});

describe("specific high-impact migrations are pinned", () => {
  // These mappings were chosen deliberately — they group by mood/chroma, not
  // by name.  Pin them so a careless rebase can't silently retarget a
  // user's stored theme to something tonally wrong.
  const PINNED: Array<[string, string]> = [
    ["dark",      "frosted-dark"],
    ["designer",  "atelier"],
    ["hacker",    "phosphor"],
    ["tron",      "phosphor"],
    ["midnight",  "observatory"],
    ["solarized", "linen"],
    ["light",     "frosted-light"],
    ["lavender",  "atrium"],
  ];

  it.each(PINNED)("%s → %s", (legacy, expected) => {
    expect(normalizeThemeId(legacy)).toBe(expected);
  });
});
