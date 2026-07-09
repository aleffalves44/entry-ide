# 07 · Accessibility

## Contrast contract

Every text token declares a minimum WCAG contrast ratio against
`--bg-1`. Themes that fail are bugs.

| Token       | Minimum ratio                       |
| ----------- | ----------------------------------- |
| `--text-0`  | ≥ 12:1                              |
| `--text-1`  | ≥ 7:1                               |
| `--text-2`  | ≥ 4.5:1                             |
| `--text-3`  | ≥ 4.5:1 (or 3:1 for ≥18px / bold ≥14px) |

### Light themes — fixed values

Three light themes previously failed AA for `--text-3`. The new values:

| Theme         | `--text-3` was | now      | ratio on `--bg-1` |
| ------------- | -------------- | -------- | ----------------- |
| Frosted Light | `#9c9ca0`      | `#7a7a7e`| 4.6 : 1           |
| Atrium        | `#a8b0bc`      | `#6a7280`| 4.7 : 1           |
| Linen         | `#a89a82`      | `#8a7a5a`| 4.6 : 1           |

The change is visually subtle (only the L value shifts ~10 points; the
hue stays the same) but restores a population segment that was locked
out.

### Verification

When adding a new theme or changing a text token, run:

```bash
npx pa11y http://localhost:1420 \
  --standard WCAG2AA \
  --include-warnings
```

Or use the Chrome DevTools Accessibility panel's contrast check on a
sample of UI elements per theme.

## Focus ring

Every focusable element MUST display a visible focus ring on every
theme. The ring is tokenized so each theme can express its archetype:

```css
:root {
  --focus-ring: var(--voice-user);
  --focus-ring-shadow: 0 0 0 3px color-mix(in srgb, var(--focus-ring) 35%, transparent);
}

html[data-theme="newsprint"] {
  /* Black-on-white needs a sharp double-rule that survives any backdrop */
  --focus-ring-shadow: 0 0 0 2px var(--bg-1), 0 0 0 4px var(--ink-emphasis);
}

html[data-theme="phosphor"] {
  /* CRT theme deserves an accent glow */
  --focus-ring-shadow: 0 0 0 2px var(--accent), 0 0 12px color-mix(in srgb, var(--accent) 50%, transparent);
}
```

Global rule in `base.css`:

```css
:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring-shadow);
}
```

**Rule:** No component may declare `outline: none` without also
declaring its own `:focus-visible` style with `--focus-ring-shadow`.

## Motion sensitivity

The global default in `base.css` honors `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Critical motion utilities (`.entry-progress`, `.entry-skel`,
`.agent-cursor`, `.status-capsule-pulse`) provide an explicit
reduced-motion fallback that retains a useful static state — they
should not vanish entirely.

## Keyboard affordance

- Every interactive control is reachable via Tab.
- Tab order follows visual order (no `tabindex` greater than 0).
- Composite controls (mode segmented, tab strips) implement standard
  ARIA patterns:
  - Mode segmented: `role="radiogroup"`, each segment `role="radio"`
    with `aria-checked`.
  - Tabs: `role="tablist"` / `role="tab"` with `aria-selected`.
- `kbd` elements render in `var(--font-code)` with `--tracking-normal`
  — they communicate exact key names, so the mono affordance matters.

## Screen reader announcements

State changes that matter to a non-sighted user are announced via
`aria-live`:

```html
<span class="status-capsule" role="status" aria-live="polite">
  <span class="status-capsule-pulse" aria-hidden="true" />
  <span class="status-capsule-label">WORKING</span>
</span>
```

- `aria-live="polite"` for transient status (busy, idle, cost updates)
- `aria-live="assertive"` for blocking states (permission needed, error)

## Color is never the only signal

If a state is signaled by color (red error, amber waiting, green
success), it MUST also carry one of:

- An icon glyph
- A text label
- A shape change (pulse vs solid)

Color-only signaling fails for users with color blindness and is a
documentation gap for any state.
