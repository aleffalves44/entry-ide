/**
 * Archetype paint tokens — v1.1.15 consolidated catalogue (8 themes).
 *
 * Hermes shipped 30 themes through 1.1.14.  v1.1.15 collapses that to
 * **eight**: four dark, four light.  Each theme has a distinguishing
 * fingerprint — an accent hue, a background tone, and (for two of
 * them) an archetype-level CSS feature like CRT scanlines or sharp
 * corners.  This test parses themes.css and pins those fingerprints
 * so a future contributor can't accidentally repaint Atelier as
 * Linen, or remove Phosphor's scanlines, without a test failing.
 *
 * The goal isn't visual coverage — it's "this theme MUST keep these
 * load-bearing tokens to feel like itself."  A handful of focused
 * assertions per theme.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let themesCss = "";
let tokensCss = "";
let themeManagerSrc = "";

beforeAll(() => {
  themesCss = readFileSync(resolve(__dirname, "../styles/themes.css"), "utf8");
  tokensCss = readFileSync(resolve(__dirname, "../styles/tokens.css"), "utf8");
  themeManagerSrc = readFileSync(
    resolve(__dirname, "../utils/themeManager.ts"),
    "utf8",
  );
});

const EXPECTED_THEMES = [
  // Darks
  "frosted-dark",
  "atelier",
  "observatory",
  "phosphor",
  // Lights
  "frosted-light",
  "linen",
  "newsprint",
  "atrium",
] as const;

/**
 * Extract the contents of the *token-defining* rule for a theme — the
 * top-level `html[data-theme="<id>"] { … }` block, not its per-element
 * descendant overrides.  Used to scope colour assertions so we don't
 * accidentally match a token from a sibling theme.
 *
 * The matcher hunts for the first opening `{` whose selector is
 * exactly `html[data-theme="<id>"]` (no descendant) and walks balanced
 * braces to the closing `}`.  Returns `""` if the block isn't found —
 * the caller's assertion will fail with a clear message.
 */
function extractBlock(css: string, themeId: string): string {
  const selector = `html[data-theme="${themeId}"]`;
  // Find every occurrence; pick the one that's followed by `{` (not a
  // descendant selector like `… .topbar {`).
  let searchFrom = 0;
  while (true) {
    const idx = css.indexOf(selector, searchFrom);
    if (idx === -1) return "";
    const after = css.slice(idx + selector.length);
    // Allow whitespace, then must be `{` for a top-level token block.
    const m = after.match(/^\s*\{/);
    if (m) {
      const openBrace = idx + selector.length + (m.index ?? 0) + m[0].length - 1;
      // Walk balanced braces from openBrace.
      let depth = 0;
      for (let i = openBrace; i < css.length; i++) {
        const ch = css[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) return css.slice(openBrace + 1, i);
        }
      }
      return "";
    }
    searchFrom = idx + selector.length;
  }
}

describe("themes.css — v1.1.15 catalogue (8 themes)", () => {
  it("defines all eight expected themes (no more, no fewer in the catalogue)", () => {
    for (const t of EXPECTED_THEMES) {
      const re = new RegExp(`html\\[data-theme=["']${t}["']\\]\\s*\\{`);
      expect(themesCss).toMatch(re);
    }
  });

  it("does not redefine any of the 22 dropped legacy themes at the token-block level", () => {
    // A migration table in themeManager.ts maps the dropped names to
    // their cousins, so the dropped names should NOT appear as
    // top-level token blocks in themes.css.  (They may legitimately
    // appear elsewhere — e.g. in comments — but not as
    // `html[data-theme="<dropped>"] {`.)
    const dropped = [
      "hacker",
      "nightowl",
      "tron",
      "duel",
      "80s",
      "midnight",
      "neon-sunset",
      "polar",
      "reactor",
      "amber",
      "macchiato",
      "shibuya",
      "solarized-dark",
      "evergreen",
      "cobalt",
      "minimal-dark",
      "transilvania",
      "rainbow",
      "data",
      "corporate",
      "designer",
      "solarized",
      "rose",
      "lavender",
      "mint",
      "sand",
    ];
    for (const id of dropped) {
      const re = new RegExp(`html\\[data-theme=["']${id}["']\\]\\s*\\{`);
      expect(themesCss).not.toMatch(re);
    }
  });
});

describe("themes.css — dark theme fingerprints", () => {
  it("frosted-dark has the Apple-y vibrant blue accent", () => {
    const block = extractBlock(themesCss, "frosted-dark");
    expect(block).toMatch(/--accent:\s*#0a84ff/i);
  });

  it("frosted-dark uses a near-black background with subtle blue chroma", () => {
    const block = extractBlock(themesCss, "frosted-dark");
    // Design-system v2: bg-0 carries 2-3% blue chroma so the frost has
    // something to refract (see docs/design-system/02-color.md "Default
    // theme atmosphere").  Pin the shape — #1a1c20 — without locking
    // every byte so minor future tuning is not blocked.
    expect(block).toMatch(/--bg-0:\s*#1a1c20/i);
  });

  it("atelier has the terracotta accent that defines its mood", () => {
    const block = extractBlock(themesCss, "atelier");
    expect(block).toMatch(/--accent:\s*#e07850/i);
  });

  it("atelier uses a warm cocoa background, not a cool neutral", () => {
    const block = extractBlock(themesCss, "atelier");
    expect(block).toMatch(/--bg-0:\s*#1a1714/i);
  });

  it("observatory has the brass accent (the Hermes signature hue)", () => {
    const block = extractBlock(themesCss, "observatory");
    expect(block).toMatch(/--accent:\s*#d4a86a/i);
  });

  it("observatory uses a deep navy background", () => {
    const block = extractBlock(themesCss, "observatory");
    expect(block).toMatch(/--bg-0:\s*#0a1018/i);
  });

  it("phosphor uses CRT phosphor green as its accent", () => {
    const block = extractBlock(themesCss, "phosphor");
    expect(block).toMatch(/--accent:\s*#b0f0a8/i);
  });

  it("phosphor uses a near-black background (not a coloured tint)", () => {
    const block = extractBlock(themesCss, "phosphor");
    // Spec: #050805 — the small green undertone is intentional.
    expect(block).toMatch(/--bg-0:\s*#050805/i);
  });

  it("phosphor paints CRT scanlines somewhere on the conversation surface", () => {
    // The defining visual gimmick of Phosphor.  Look for a
    // repeating-linear-gradient inside any phosphor-scoped rule.
    expect(themesCss).toMatch(
      /html\[data-theme=["']phosphor["']\][\s\S]*?repeating-linear-gradient/,
    );
  });
});

describe("themes.css — light theme fingerprints", () => {
  it("frosted-light shares the Apple-y vibrant blue accent with its dark twin", () => {
    const block = extractBlock(themesCss, "frosted-light");
    expect(block).toMatch(/--accent:\s*#0a84ff/i);
  });

  it("frosted-light uses an off-white background with cool tint", () => {
    const block = extractBlock(themesCss, "frosted-light");
    // Design-system v2: bg-0 carries a hint of cool chroma so the
    // frost reads as glass-over-something (mirrors the Frosted Dark
    // treatment).  See docs/design-system/02-color.md.
    expect(block).toMatch(/--bg-0:\s*#f4f6fa/i);
  });

  it("linen has the terracotta accent (the Atelier light counterpart)", () => {
    const block = extractBlock(themesCss, "linen");
    expect(block).toMatch(/--accent:\s*#c45a32/i);
  });

  it("linen uses a warm cream paper background", () => {
    const block = extractBlock(themesCss, "linen");
    expect(block).toMatch(/--bg-0:\s*#f4ede0/i);
  });

  it("newsprint uses brass as its live accent and ink as the body color (duotone)", () => {
    const block = extractBlock(themesCss, "newsprint");
    // Design-system v2: Newsprint was previously mono — pure black
    // ink for body AND accent, which collapsed CTAs/links/selection
    // into body text.  The redesign promotes brass to --accent so the
    // page has a real duotone (ink + warm voice); true ink stays
    // available via --ink-emphasis.  See docs/design-system/02-color.md
    // "Atrium and Newsprint corrections".
    expect(block).toMatch(/--accent:\s*#b8862a/i);
    expect(block).toMatch(/--ink-emphasis:\s*#0a0a0a/i);
  });

  it("newsprint uses an off-white broadsheet background", () => {
    const block = extractBlock(themesCss, "newsprint");
    expect(block).toMatch(/--bg-0:\s*#f7f4ec/i);
  });

  it("atrium has a slate-teal accent that distinguishes it from Frosted Light", () => {
    const block = extractBlock(themesCss, "atrium");
    // Design-system v2: the original #4a6a8c was too desaturated to
    // pop on pale daylight surfaces.  Shifted toward a richer slate-
    // teal so selected items earn their "daylight" identity.  See
    // docs/design-system/02-color.md "Atrium and Newsprint corrections".
    expect(block).toMatch(/--accent:\s*#2f6f9a/i);
  });

  it("atrium uses a soft blue-gray background (low-contrast daylight)", () => {
    const block = extractBlock(themesCss, "atrium");
    expect(block).toMatch(/--bg-0:\s*#eef2f6/i);
  });
});

describe("themeManager.ts — radius overrides per theme", () => {
  // The radius story is split: themes.css declares the radii inside
  // each theme's token block, but themeManager.ts ALSO has to honour
  // them when applyUiScale() writes inline styles (because inline
  // styles beat selectors).  This block pins the JS side — themes.css
  // alone wouldn't be enough to enforce theme-specific corners under
  // the default UI scale.

  it("frosted-dark gets soft Apple-style rounding (radius >= 6)", () => {
    // Match the THEME_TOKEN_OVERRIDES entry for frosted-dark and
    // assert its --radius is at least 6.
    const m = themeManagerSrc.match(
      /"frosted-dark"\s*:\s*\{[\s\S]*?"--radius"\s*:\s*(\d+)/,
    );
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(6);
  });

  it("frosted-light mirrors its dark twin's soft rounding", () => {
    const m = themeManagerSrc.match(
      /"frosted-light"\s*:\s*\{[\s\S]*?"--radius"\s*:\s*(\d+)/,
    );
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(6);
  });

  it("phosphor uses sharp corners (radius 0 — a CRT doesn't round)", () => {
    const m = themeManagerSrc.match(
      /"phosphor"\s*:\s*\{[\s\S]*?"--radius"\s*:\s*(\d+)/,
    );
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(0);
  });

  it("newsprint uses sharp corners (radius 0 — broadside grid wants right angles)", () => {
    const m = themeManagerSrc.match(
      /"newsprint"\s*:\s*\{[\s\S]*?"--radius"\s*:\s*(\d+)/,
    );
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(0);
  });
});

describe("tokens.css — archetype defaults still present", () => {
  it("tokens.css defines the core tool-card archetype tokens with default values", () => {
    expect(tokensCss).toMatch(/--tool-card-bg:\s*var\(--bg-1\)/);
    expect(tokensCss).toMatch(/--tool-card-border:\s*1px solid var\(--rule-strong/);
    expect(tokensCss).toMatch(/--tool-card-radius:\s*var\(--radius\)/);
    expect(tokensCss).toMatch(/--tool-card-shadow:\s*none/);
    expect(tokensCss).toMatch(/--tool-card-backdrop:\s*none/);
  });
});
