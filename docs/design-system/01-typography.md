# 01 · Typography

## Type scale

A modular scale at ratio **1.125** (major second), rooted at **13px** UI
base. The scale is logarithmic so adjacent steps register as hierarchy.

| Token            | Value | Role                                              |
| ---------------- | ----- | ------------------------------------------------- |
| `--text-2xs`     | 10px  | Tracked uppercase labels ONLY (never lowercase)   |
| `--text-xs`      | 11px  | Secondary metadata, kbd captions                  |
| `--text-sm`      | 12px  | Small UI text, chips                              |
| `--text-base`    | 13px  | UI default                                        |
| `--text-md`      | 14px  | Body prose, composer                              |
| `--text-lg`      | 16px  | Long-form reading text                            |
| `--text-xl`      | 18px  | Pull quotes, oversized inline                     |
| `--text-2xl`     | 22px  | Heading 2                                         |
| `--text-3xl`     | 28px  | Heading 1, section heads                          |
| `--text-display` | 36px  | Empty state hero, onboarding                      |

**Rule:** `--text-2xs` is for **tracked uppercase labels only**. Lowercase
at 10px is below WCAG readability on non-Retina displays. If a value
isn't uppercase, it doesn't get this size.

## Leading (line-height)

| Token                | Value | Role                              |
| -------------------- | ----- | --------------------------------- |
| `--leading-none`     | 1     | Icons-only, single-glyph alignment |
| `--leading-tight`    | 1.2   | Headings (h1, h2)                  |
| `--leading-snug`     | 1.35  | Chips, buttons, list items, h3-h4  |
| `--leading-normal`   | 1.5   | UI default                         |
| `--leading-relaxed`  | 1.65  | Body prose, message bodies         |
| `--leading-loose`    | 1.8   | Code blocks, diff output           |

Use **unitless** multipliers so children inherit proportionally.

## Weight

The variable axis on Inter Tight (100–900) is fully usable. Use named
tokens, never raw numbers.

| Token              | Value | Role                                  |
| ------------------ | ----- | ------------------------------------- |
| `--weight-light`   | 350   | Display heads, light decorative       |
| `--weight-regular` | 420   | Body default (bumped from 400 — Inter Tight's optical sweet spot on dark) |
| `--weight-medium`  | 520   | Chip labels, list item names          |
| `--weight-semibold`| 620   | Section titles, headings              |
| `--weight-bold`    | 720   | Emphasized inline, strong CTAs        |

Per-theme weight remap is allowed:

```css
html[data-theme="newsprint"] { --weight-regular: 460; --weight-semibold: 700; }
html[data-theme="phosphor"]  { --weight-regular: 400; --weight-semibold: 600; }
```

## Tracking (letter-spacing)

| Token               | Value    | Role                                            |
| ------------------- | -------- | ----------------------------------------------- |
| `--tracking-tight`  | -0.02em  | Display ≥ 22px                                  |
| `--tracking-snug`   | -0.01em  | Headings 16–20px                                 |
| `--tracking-normal` | 0        | Body, default                                    |
| `--tracking-wide`   | 0.02em   | Body de-emphasis                                 |
| `--tracking-wider`  | 0.05em   | Tracked uppercase 12–14px                        |
| `--tracking-widest` | 0.08em   | Tracked uppercase ≤ 11px                         |

**Rule:** Never mix `em` and `px` for tracking. The codebase had `0.3px`,
`0.5px`, `0.06em`, `0.08em` mixed — they don't scale together.

## Font families

| Token                       | Value                                                  | Role                                  |
| --------------------------- | ------------------------------------------------------ | ------------------------------------- |
| `--font-ui`                 | Inter Tight, system-ui, sans-serif                     | Chrome, headings, prose default       |
| `--font-display`            | Inter Tight, ...                                       | Alias of `--font-ui` for clarity      |
| `--font-serif`              | Newsreader, Lyon Text, Charter, Georgia, serif         | Editorial mastheads, blockquotes      |
| `--font-display-editorial`  | per-theme: serif (editorial themes) or sans            | Masthead font that themes override    |
| `--font-code`               | JetBrains Mono Variable, ui-monospace, SF Mono, Menlo  | Code blocks, terminal, composer       |
| `--font-numeric`            | `var(--font-ui)` + tabular-nums + slashed-zero         | Status bar numerics, token counts     |
| `--font-mono` *(legacy)*    | alias of `--font-code`                                 | Back-compat only                      |

### Where each font renders

**Inter Tight** (UI sans)
- All chrome (status bar, activity bar, session list, settings)
- Body text in non-editorial themes
- Status bar numerics (with `tabular-nums slashed-zero`)
- kbd captions when used as UI labels (not as code keys)

**JetBrains Mono Variable** (code mono)
- All code blocks (`pre`, fenced markdown)
- Terminal output
- Composer textarea (the user is writing code-adjacent text)
- Inline code (`<code>`)
- kbd elements showing key combinations

**Newsreader** (editorial serif)
- Masthead/session flag in editorial themes (Atelier, Linen, Observatory, Newsprint)
- Blockquotes in agent markdown across all themes
- User message body in Atelier/Linen only (handwritten-margin feel)
- Empty-state hero text
- WebFetch / WebSearch excerpts

## Optical sizing

Both Inter Tight and Newsreader ship a usable optical-size axis. Pin via
`font-variation-settings`:

```css
.agent-md-h1            { font-variation-settings: "opsz" 24; }
.agent-md-h2            { font-variation-settings: "opsz" 18; }
.agent-md-blockquote    { font-variation-settings: "opsz" 14; }
.agent-empty-display    { font-variation-settings: "opsz" 36; }
```

Display sizes get a tighter optical instance; small sizes get a sharper,
more open instance with thicker hairlines.

## Heading hierarchy in agent markdown

| Level | Size | Leading | Weight | Tracking          | Notes |
| ----- | ---- | ------- | ------ | ----------------- | ----- |
| h1    | 24px | tight   | 620    | snug              | opsz 24 |
| h2    | 20px | tight   | 620    | snug              | opsz 20 |
| h3    | 16px | snug    | 620    | normal            | (drop the uppercase hack) |
| h4    | 14px | snug    | 620    | wider, UPPERCASE  | secondary ink color |

This is a true editorial scale: every level differs from its neighbor by
≥1.2× — the minimum required for hierarchy to register.

## Font feature settings

```css
--font-code-features: "calt", "liga", "ss01", "tnum", "zero";
```

Scope ligatures (`calt`, `liga`) to code-only usage. Don't apply them to
chip labels or composer chrome — substitutions like `==` → `⇒` are
distracting in UI text.

## Bad patterns to avoid

```css
/* ✗ Raw weight numbers */
.button { font-weight: 600; }

/* ✓ Use tokens */
.button { font-weight: var(--weight-semibold); }

/* ✗ Mixing units for tracking */
.label { letter-spacing: 0.5px; }

/* ✓ Use tokens */
.label { letter-spacing: var(--tracking-widest); }

/* ✗ Hardcoded line-height */
.body { line-height: 1.6; }

/* ✓ Use tokens */
.body { line-height: var(--leading-relaxed); }

/* ✗ Mono everywhere */
.cost { font-family: var(--font-mono); }

/* ✓ Numeric is its own role */
.cost { font-family: var(--font-numeric); font-variant-numeric: tabular-nums slashed-zero; }
```
