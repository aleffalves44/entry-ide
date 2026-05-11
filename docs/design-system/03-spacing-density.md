# 03 · Spacing, density & layout

## Spacing scale

A geometric ladder rooted at a **4px baseline**:

| Token       | Value | Common usage                              |
| ----------- | ----- | ----------------------------------------- |
| `--space-1` | 4px   | Tight inline gap, small icons             |
| `--space-2` | 8px   | Default chip padding, inline gap          |
| `--space-3` | 12px  | Panel inner padding, list item padding    |
| `--space-4` | 16px  | Card padding, section gap                 |
| `--space-5` | 24px  | Major section gap                         |
| `--space-6` | 32px  | Page-level rhythm                         |
| `--space-7` | 48px  | Hero spacing                              |
| `--space-8` | 72px  | Editorial masthead breathing              |

**Rule:** Padding/margin/gap values in component CSS MUST come from this
ladder. Stylelint enforces this with a rule rejecting raw `\d+px` in
`padding | margin | gap` declarations.

## Density

Every row/chrome height routes through a **density multiplier**:

```css
:root {
  --density-y: 1;                                    /* default = cozy */
  --row-pad-y: calc(var(--space-2) * var(--density-y));
  --statusbar-h: calc(28px * var(--density-y));
  --topbar-h: calc(40px * var(--density-y));
  --btn-size: calc(28px * var(--density-y));
}
```

Settings → Appearance offers three presets:

| Preset    | `--density-y` |
| --------- | ------------- |
| Compact   | 0.85          |
| Cozy      | 1.0 (default) |
| Spacious  | 1.15          |

**Rule:** Components that have a height MUST use one of the density-bound
tokens or compute their height in terms of `--density-y`. Hardcoded `28px`
is forbidden.

## Panel snap grid

User-resizable panels (sidebar, context panel) **snap to multiples of
24px** during drag. Default widths must land on the grid:

- `--sidebar-w: 240px` (10 × 24)
- `--context-w: 288px` (12 × 24)

The resize handle emits a 1-frame brass flash on snap. Continuous-drag
freedom is rejected in favor of discrete designed states.

## Composer measure cap

The composer card bleeds full-width across the pane, but the **text
content** is capped:

```css
.session-composer-card {
  max-width: 76ch;
  margin: 0 auto;
}
```

This protects the most important text surface in the app from billboard
mode on wide displays. 76ch is the upper edge of the comfortable measure
band (Bringhurst recommends 45–75; we permit one ch of slack for code
fonts).

## Divider hierarchy

Three tiers of rule, each with its own visual weight:

```css
:root {
  --rule-zone: var(--border-light);        /* brighter */
  --rule-card: var(--border);
  --rule-hair: color-mix(in srgb, var(--border) 50%, transparent);
}
```

| Tier  | Where it lives                                         |
| ----- | ------------------------------------------------------ |
| zone  | Cardinal panel splits (activity↔sidebar, sidebar↔main, main↔rail, main↔status) |
| card  | Between cards within one panel                         |
| hair  | Sub-item rules inside a card                           |

**Rule:** Cardinal boundaries always use `--rule-zone`. A panel that
borders another panel with a `--rule-card` is wrong — zones must be
visually distinct from card-internal rules.

## Session row composition

Sidebar rows organize metadata into **two zones**:

1. **Identity** — name + (optional) description
2. **State** — git row + agent monogram + phase tag

Gap between zones is `var(--space-2)`. Lines within the same zone use
`var(--space-1)`.

**Progressive disclosure:** when a row is not `active` and not hovered,
description and project chips are hidden. Sidebar reads as glanceable
index by default; metadata appears on demand.

## Status bar zone structure

Status bar items are grouped into **three zones** with `--rule-zone`
dividers between them:

1. **Identity** — branch, version
2. **Session-state** — mode segmented control, working/needs-input capsule
3. **Metrics** — tokens, cost, elapsed

Color is reserved for change-of-state. Static metadata uses `--text-2`.

## Bad patterns to avoid

```css
/* ✗ Magic numbers */
.session-item { padding: 8px 10px 8px 0; gap: 5px; }

/* ✓ Token grid */
.session-item { padding: var(--space-2) var(--space-3) var(--space-2) 0; gap: var(--space-2); }

/* ✗ Hardcoded height fighting density */
.status-bar { height: 28px; }

/* ✓ Density-aware */
.status-bar { height: var(--statusbar-h); }

/* ✗ Continuous resize, any pixel */
const handleResize = (delta) => setWidth(w => clamp(w + delta, 180, 480));

/* ✓ Snapped resize */
const handleResize = (delta) => setWidth(w => {
  const next = clamp(w + delta, 180, 480);
  return Math.round(next / 24) * 24;
});
```
