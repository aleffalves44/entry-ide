# 05 · Motion

## Easing & duration tokens

```css
:root {
  /* Easings */
  --ease-out-expo:  cubic-bezier(0.16, 1.00, 0.30, 1.00);  /* dramatic out */
  --ease-out-soft:  cubic-bezier(0.22, 0.61, 0.36, 1.00);  /* default UI */
  --ease-spring:    cubic-bezier(0.34, 1.56, 0.64, 1.00);  /* overshoot for delight */
  --ease-standard:  cubic-bezier(0.20, 0.00, 0.00, 1.00);  /* Material standard */

  /* Durations */
  --dur-tap:    80ms;
  --dur-quick: 140ms;
  --dur-base:  220ms;
  --dur-slow:  360ms;
}
```

**Rule:** Hand-rolled `cubic-bezier(...)` in component CSS is forbidden.
Use a token.

## Mapping use case → token pair

| Pattern                            | Duration         | Easing               |
| ---------------------------------- | ---------------- | -------------------- |
| Hover background / color tint      | `--dur-quick`    | `--ease-out-soft`    |
| Button press                       | `--dur-tap`      | `--ease-standard`    |
| Panel reveal, message entry        | `--dur-base`     | `--ease-out-expo`    |
| Sliding tab underline              | `--dur-base`     | `--ease-out-expo`    |
| Activity bar rail travel           | `--dur-base`     | `--ease-spring`      |
| Modal / dialog entrance            | `--dur-slow`     | `--ease-out-expo`    |
| Skeleton shimmer                   | 1.6s loop        | `ease-in-out`        |
| Status capsule pulse               | 2.0s loop        | `ease-in-out`        |
| Needs-input urgent pulse           | 0.7s loop        | `ease-in-out`        |

## Indeterminate progress

One canonical loader replaces the three rotating-border CSS spinners:

```css
.hermes-progress {
  position: relative;
  height: 2px;
  background: color-mix(in srgb, var(--voice-user) 14%, transparent);
  border-radius: 1px;
  overflow: hidden;
}
.hermes-progress::after {
  content: "";
  position: absolute;
  inset: 0;
  width: 33%;
  background: linear-gradient(90deg, transparent, var(--voice-user) 50%, transparent);
  animation: hermes-progress-sweep 1.2s var(--ease-out-soft) infinite;
}
@keyframes hermes-progress-sweep {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
@media (prefers-reduced-motion: reduce) {
  .hermes-progress::after { animation: none; opacity: 0.6; }
}
```

## Skeleton loaders

```css
.hermes-skel {
  background: linear-gradient(
    90deg,
    var(--bg-2) 0%,
    color-mix(in srgb, var(--voice-user) 8%, var(--bg-2)) 50%,
    var(--bg-2) 100%
  );
  background-size: 200% 100%;
  animation: hermes-skel-shimmer 1.6s ease-in-out infinite;
  border-radius: 4px;
  color: transparent;
  user-select: none;
}
@keyframes hermes-skel-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
@media (prefers-reduced-motion: reduce) { .hermes-skel { animation: none; } }
```

## Message entry stagger

New agent messages and tool cards animate in once on mount, then never
again on scroll. React sets `data-mounted="true"` on next frame to short
out the animation for subsequent scroll-in repaints.

```css
@keyframes agent-block-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0);   }
}

.agent-message,
.agent-tool-use,
.agent-tool-result {
  animation: agent-block-in var(--dur-base) var(--ease-out-expo) backwards;
}
.agent-message[data-mounted="true"],
.agent-tool-use[data-mounted="true"],
.agent-tool-result[data-mounted="true"] {
  animation: none;
}
```

## Sliding tab underline

Replace per-tab `border-bottom-color` flicker with a single absolutely-
positioned underline whose `--tab-x` and `--tab-w` are set by React:

```css
.session-pane-tabs::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: var(--tab-x, 0);
  width: var(--tab-w, 0);
  height: 2px;
  background: var(--voice-user);
  border-radius: 2px 2px 0 0;
  transition:
    left var(--dur-base) var(--ease-out-expo),
    width var(--dur-base) var(--ease-out-expo);
}
```

## Activity bar rail

One absolutely-positioned brass capsule travels between active tabs with
a spring; **icon geometry never changes** on hover.

```css
.activity-bar-rail {
  position: absolute;
  left: 0;
  width: 3px;
  height: 14px;
  border-radius: 0 2px 2px 0;
  background: var(--voice-user);
  box-shadow: 0 0 8px color-mix(in srgb, var(--voice-user) 30%, transparent);
  transition: top var(--dur-base) var(--ease-spring);
}
```

## Resize handle snap

During drag, the handle turns brass with a glow and the pill widens
(`scaleY(1.3)`). When within 4% of common ratios (33% / 50% / 67%) the
panels snap with a 1-frame brass flash.

## Reduced motion

Every animation MUST have a `prefers-reduced-motion` fallback that either
removes the animation or replaces it with an instant state. No exceptions.

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

This default global rule is in `base.css`. Specific motion utilities
(skeleton, progress sweep) provide their own fallback that retains a
static useful state rather than disappearing entirely.

## Bad patterns to avoid

```css
/* ✗ Generic rotating-border spinner */
.spinner {
  border: 2px solid transparent;
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}

/* ✓ Brass sweep */
<div class="hermes-progress" />

/* ✗ Hardcoded easing/duration */
.button { transition: background 0.15s ease; }

/* ✓ Tokenized */
.button { transition: background var(--dur-quick) var(--ease-out-soft); }
```
