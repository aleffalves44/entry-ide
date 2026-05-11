# 08 · Tokens reference

Flat reference of every token, its value range, and intended usage. Use
this as the lookup; the per-discipline docs (01–07) explain the
rationale.

## Typography

```css
/* Sizes */
--text-2xs:     10px;    /* tracked uppercase only */
--text-xs:      11px;
--text-sm:      12px;
--text-base:    13px;    /* UI default */
--text-md:      14px;    /* body prose, composer */
--text-lg:      16px;
--text-xl:      18px;
--text-2xl:     22px;
--text-3xl:     28px;
--text-display: 36px;

/* Leading */
--leading-none:     1;
--leading-tight:    1.2;
--leading-snug:     1.35;
--leading-normal:   1.5;
--leading-relaxed:  1.65;
--leading-loose:    1.8;

/* Weight (variable axis on Inter Tight) */
--weight-light:     350;
--weight-regular:   420;
--weight-medium:    520;
--weight-semibold:  620;
--weight-bold:      720;

/* Tracking */
--tracking-tight:   -0.02em;
--tracking-snug:    -0.01em;
--tracking-normal:   0;
--tracking-wide:     0.02em;
--tracking-wider:    0.05em;
--tracking-widest:   0.08em;

/* Font families */
--font-ui:        "Inter Tight", system-ui, sans-serif;
--font-display:   var(--font-ui);
--font-serif:     "Newsreader", "Lyon Text", Charter, Georgia, serif;
--font-display-editorial: var(--font-ui);  /* themes override to serif */
--font-code:      "JetBrains Mono Variable", ui-monospace, "SF Mono", Menlo, monospace;
--font-numeric:   var(--font-ui);          /* + tabular-nums slashed-zero */
--font-mono:      var(--font-code);        /* legacy alias */

--font-code-features: "calt", "liga", "ss01", "tnum", "zero";
```

## Color (default — Frosted Dark)

```css
/* Surfaces */
--bg-0:        #1a1c20;   /* deepest */
--bg-1:        #20232a;   /* default panel */
--bg-2:        #292d35;   /* hover */
--bg-3:        #353a44;
--bg-hover:    var(--bg-2);
--bg-active:   #48484a;
--bg-elevated: #2c2c2e;

/* Ink */
--text-0: #f5f5f7;
--text-1: #d6d6d9;
--text-2: #8e8e93;
--text-3: #5c5c61;

/* Voice */
--voice-user:  #ffb340;
--voice-agent: #0a84ff;

/* Legacy aliases */
--accent:        var(--voice-agent);
--accent-bright: #5ea7ff;
--accent-dim:    rgba(10, 132, 255, 0.18);
--brass:         var(--voice-user);
--brass-bright:  #ffc870;
--brass-dim:     rgba(255, 179, 64, 0.18);

/* Semantic ramps */
--success:        #30d158;
--success-bright: #5cdf7c;
--success-dim:    rgba(48, 209, 88, 0.18);

--warning:        #ffb340;
--warning-bright: #ffc870;
--warning-dim:    rgba(255, 179, 64, 0.18);

--danger:         #ff453a;
--danger-bright:  #ff6f66;
--danger-dim:     rgba(255, 69, 58, 0.18);

--info:           #64d2ff;
--info-bright:    #8ee0ff;
--info-dim:       rgba(100, 210, 255, 0.18);

/* Legacy semantic aliases */
--green:  var(--success);
--red:    var(--danger);
--yellow: var(--warning);
--error:  var(--danger);
--violet: #bf5af2;
--violet-dim: rgba(191, 90, 242, 0.18);

/* Rules */
--rule-zone: var(--border-light);
--rule-card: var(--border);
--rule-hair: color-mix(in srgb, var(--border) 50%, transparent);
--border:        #2d2d2f;
--border-light:  #3a3a3c;
--rule:          var(--rule-card);
--rule-strong:   var(--rule-zone);

/* Tool family */
--tool-file:   var(--violet);
--tool-exec:   var(--success);
--tool-search: var(--warning);
--tool-web:    var(--info);
--tool-error:  var(--danger);

/* Shadow tint (per theme) */
--shadow-tint: #000;
```

## Elevation

```css
--shadow-1: 0 1px 2px  color-mix(in srgb, var(--shadow-tint) 18%, transparent);
--shadow-2: 0 4px 12px color-mix(in srgb, var(--shadow-tint) 28%, transparent);
--shadow-3: 0 8px 24px color-mix(in srgb, var(--shadow-tint) 36%, transparent);
--shadow-4: 0 16px 48px color-mix(in srgb, var(--shadow-tint) 50%, transparent);
```

## Focus ring

```css
--focus-ring:        var(--voice-user);
--focus-ring-shadow: 0 0 0 3px color-mix(in srgb, var(--focus-ring) 35%, transparent);
```

## Spacing & density

```css
/* Spacing ladder (4px baseline) */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-7: 48px;
--space-8: 72px;

/* Density */
--density-y:    1;
--row-pad-y:    calc(var(--space-2) * var(--density-y));
--statusbar-h:  calc(28px * var(--density-y));
--topbar-h:     calc(40px * var(--density-y));
--btn-size:     calc(28px * var(--density-y));

/* Layout widths */
--sidebar-w:      240px;   /* on 24px snap grid */
--context-w:      288px;   /* on 24px snap grid */
--activity-bar-w: 36px;

/* Radius */
--radius:      6px;
--radius-sm:   4px;
--radius-lg:   10px;
--radius-pill: 14px;

/* Icons */
--icon-size: 18px;
```

## Motion

```css
/* Easings */
--ease-out-expo:  cubic-bezier(0.16, 1.00, 0.30, 1.00);
--ease-out-soft:  cubic-bezier(0.22, 0.61, 0.36, 1.00);
--ease-spring:    cubic-bezier(0.34, 1.56, 0.64, 1.00);
--ease-standard:  cubic-bezier(0.20, 0.00, 0.00, 1.00);

/* Durations */
--dur-tap:    80ms;
--dur-quick: 140ms;
--dur-base:  220ms;
--dur-slow:  360ms;
```

## Archetype paint (agent timeline)

```css
--tool-card-bg:        var(--bg-1);
--tool-card-border:    1px solid var(--rule-card);
--tool-card-radius:    var(--radius);
--tool-card-shadow:    none;            /* paper-cards default */
--tool-card-backdrop:  none;
--tool-card-pad:       0;

--surface-scanlines-opacity: 0;
--surface-grain-opacity:     0;
--surface-vignette:          none;

--turn-separator:        1px solid var(--rule-card);
--result-footer-border:  1px dashed var(--rule-card);
```

## Brand / package badges (unchanged)

```css
--badge-git:        #f78166;
--badge-npm:        #cb3837;
--badge-yarn:       #2c8ebb;
--badge-pnpm:       #f9ad00;
--badge-bun:        #fbf0df;
--badge-docker:     #2496ed;
--badge-cargo:      #dea584;
--badge-python:     #3776ab;
--badge-go:         #00add8;
--badge-k8s:        #326ce5;
--badge-brew:       #fbb040;
--badge-next:       #ffffff;
--badge-vite:       #646cff;
--badge-tauri:      #ffc131;
--badge-terraform:  #7b42bc;
--badge-typescript: #3178c6;
--badge-test:       #33ff99;
--badge-prisma:     #2d3748;
```
