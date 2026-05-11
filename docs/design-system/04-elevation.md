# 04 · Elevation & shadows

## Why elevation tokens exist

Pre-redesign, every floating surface invented its own shadow:

```css
/* PromptComposer */     box-shadow: 0 20px 60px rgba(0,0,0,.5);
/* status-theme-popover */ box-shadow: 0 8px 24px rgba(0,0,0,.4);
/* frosted-dark popover */ box-shadow: 0 10px 40px rgba(0,0,0,.4), 0 0 0 .5px rgba(255,255,255,.05);
```

Three components, three subtly different shadows, none reusable. Light
themes inherited dark-tinted shadows verbatim and read as muddy grey
halos rather than crisp lift.

## The ramp

| Token         | Role                              | Composition                                              |
| ------------- | --------------------------------- | -------------------------------------------------------- |
| `--shadow-1`  | Cards, resting elevation          | `0 1px 2px color-mix(in srgb, var(--shadow-tint) 18%, transparent)`  |
| `--shadow-2`  | Dropdowns, menus                  | `0 4px 12px color-mix(in srgb, var(--shadow-tint) 28%, transparent)` |
| `--shadow-3`  | Popovers, tooltips                | `0 8px 24px color-mix(in srgb, var(--shadow-tint) 36%, transparent)` |
| `--shadow-4`  | Dialogs, command palette          | `0 16px 48px color-mix(in srgb, var(--shadow-tint) 50%, transparent)` |

## The tint

```css
:root { --shadow-tint: #000; }                       /* dark themes */

html[data-theme="linen"]      { --shadow-tint: #4a3e30; }  /* warm under-paper */
html[data-theme="atrium"]     { --shadow-tint: #2a3548; }  /* cool graphite */
html[data-theme="newsprint"]  { --shadow-tint: #2a221a; }  /* ink dust */
html[data-theme="frosted-light"] { --shadow-tint: #1a1f2a; } /* cool slate */
```

The tint per theme is what makes shadows read as **warm under-paper** on
Linen and **cool graphite** on Atrium, rather than the iOS-modal-on-Mojave
grey blur that comes from pasting `#000` onto cream paper.

## Pairing with `--bg-elevated`

Any floating surface uses **both** elevation tokens together:

```css
.popover {
  background: var(--bg-elevated);
  box-shadow: var(--shadow-3);
  border-radius: var(--radius-lg);
}
```

`--bg-elevated`:

```css
:root             { --bg-elevated: #2c2c2e; }       /* slightly lighter than bg-1 */
html[data-theme="frosted-light"] { --bg-elevated: #ffffff; }
html[data-theme="linen"]   { --bg-elevated: #fffaf0; } /* warmer than its bg-1 */
```

## Composer focus is elevation

The composer's focus state is conceptually a floating surface — the slate
"lifts" toward the user. Pre-fix, this stacked four hand-rolled shadows;
now it uses tokens + a focus ring:

```css
.session-composer:focus-within .session-composer-card {
  background: var(--bg-elevated);
  box-shadow: var(--shadow-2), var(--focus-ring-shadow);
  border-color: var(--focus-ring);
}
```

## Bad patterns to avoid

```css
/* ✗ Hand-rolled multi-stack */
.modal {
  box-shadow:
    0 2px 6px rgba(0,0,0,.5),
    0 10px 24px rgba(0,0,0,.4),
    0 0 0 1px rgba(255,255,255,.06);
}

/* ✓ Token */
.modal { box-shadow: var(--shadow-4); }

/* ✗ Same shadow across light + dark themes */
.popover { box-shadow: 0 4px 12px rgba(0,0,0,.4); }
/* (renders as a muddy grey halo on Linen/Atrium) */

/* ✓ Theme-tinted via token */
.popover { box-shadow: var(--shadow-3); }
```
