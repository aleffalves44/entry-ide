# 02 · Color & themes

## Token vocabulary

### Surfaces (backgrounds)

| Token            | Role                                          |
| ---------------- | --------------------------------------------- |
| `--bg-0`         | Deepest ground (page, activity bar)           |
| `--bg-1`         | Default panel surface                         |
| `--bg-2`         | Hover, recessed surface                       |
| `--bg-3`         | Active selection background                   |
| `--bg-hover`     | Interactive hover (alias of `--bg-2`)         |
| `--bg-active`    | Pressed / pressed-active state                |
| `--bg-elevated`  | **Floating** surfaces (popovers, dialogs)     |

`--bg-elevated` is slightly lighter than `--bg-1` on dark themes, true
white on light themes. Use it for any surface that visually floats.

### Text (ink)

| Token        | Role               | Min contrast vs `--bg-1` |
| ------------ | ------------------ | ------------------------ |
| `--text-0`   | Headings, emphasis | ≥ 12:1                   |
| `--text-1`   | Body               | ≥ 7:1                    |
| `--text-2`   | Secondary metadata | ≥ 4.5:1                  |
| `--text-3`   | Tertiary, captions | ≥ 4.5:1 (or 3:1 ≥14px bold) |

This is the **contrast contract** (see [07-accessibility.md](./07-accessibility.md)).
Light themes that previously failed (Frosted Light, Atrium, Linen) have
been retuned. New themes must satisfy these ratios.

### Rules (dividers)

| Token             | Role                                                  |
| ----------------- | ----------------------------------------------------- |
| `--rule-zone`     | **Cardinal zone boundaries** (sidebar/main/rail/status) |
| `--rule-card`     | Between cards within a panel                          |
| `--rule-hair`     | Sub-item rules (50% opacity)                          |

Cardinal zone rules use a **brighter** shade than card rules so the four
zones separate at a glance. Pre-fix, `--border` equalled `--bg-2`, so
zones disappeared when adjacent panels used different surfaces.

### Voice colors

| Token             | Role                                                |
| ----------------- | --------------------------------------------------- |
| `--voice-user`    | **Warm**. Operator's color. Composer rail, caret.   |
| `--voice-agent`   | **Cool**. Agent's color. Assistant rail, thinking.  |

In Frosted Dark: warm amber `#ffb340` / cool blue `#0a84ff`.
In Newsprint: brass `#b8862a` / true ink `#0a0a0a` (the duotone restores its identity).
In Atelier, Linen, Phosphor: both alias to a single accent (mono-tone identity).

`--brass` remains as a legacy alias for `--voice-user`.

### Semantic ramps

Every semantic intent ships three variants:

| Family    | Base       | -bright   | -dim                          |
| --------- | ---------- | --------- | ----------------------------- |
| `success` | `#30d158`  | `#5cdf7c` | `rgba(48,209,88,.18)`         |
| `warning` | `#ffb340`  | `#ffc870` | `rgba(255,179,64,.18)`        |
| `danger`  | `#ff453a`  | `#ff6f66` | `rgba(255,69,58,.18)`         |
| `info`    | `#64d2ff`  | `#8ee0ff` | `rgba(100,210,255,.18)`       |

Legacy `--green`, `--red`, `--yellow` are aliases of `success`, `danger`,
`warning` respectively.

**Distinguish `warning` from `waiting`**: yellow-ish hues should not
overload. `warning` is amber `#ffb340` (action needed); the "waiting"
hue, where used, is a separate softer tone.

### Tool family accents

| Token            | Semantic                  |
| ---------------- | ------------------------- |
| `--tool-file`    | File ops (violet)         |
| `--tool-exec`    | Execution (sage / success) |
| `--tool-search`  | Search (amber / warning)  |
| `--tool-web`     | Web (cool / info)         |
| `--tool-error`   | Error (danger)            |

## Default theme atmosphere

Frosted Dark is the default — what every new user sees on launch. Pre-fix,
the backgrounds were pure neutral greys; the frost had nothing to refract.

The default theme now carries a **2–3% blue chroma** in its surfaces:

```css
html[data-theme="frosted-dark"] {
  --bg-0: #1a1c20;
  --bg-1: #20232a;
  --bg-2: #292d35;
  --bg-3: #353a44;
}
```

Frosted Light gets the same treatment in reverse:

```css
html[data-theme="frosted-light"] {
  --bg-0: #f4f6fa;
  --bg-1: #ffffff;
  --bg-2: #eaedf2;
}
```

The conversation surface picks up a cool radial wash to mirror the warm
wash on Atelier. Each archetype has a signature glow.

## Atrium and Newsprint corrections

**Atrium** previously used a muted slate `#4a6a8c` as accent — chroma too
low for the "daylight" identity it advertised. Bumped to `#2f6f9a` (chroma
~30) so selected items pop against pale surfaces.

**Newsprint** previously used true black `#0a0a0a` as accent, collapsing
links/CTAs/selection into body text. The brass `#b8862a` is now the live
accent (`--voice-user`); ink stays as `--ink-emphasis` for rules and body
type. The newspaper finally has its duotone.

## Bad patterns to avoid

```css
/* ✗ Hardcoded fallback for a missing token */
.tag { color: var(--warning, #d29922); }

/* ✓ Define the token */
.tag { color: var(--warning); }  /* declared in tokens.css */

/* ✗ Hand-rolled stack of shadows */
.popover {
  box-shadow:
    0 2px 4px rgba(0,0,0,.4),
    0 8px 16px rgba(0,0,0,.3),
    0 0 0 1px rgba(255,255,255,.05);
}

/* ✓ Use elevation tokens */
.popover {
  box-shadow: var(--shadow-3);
  background: var(--bg-elevated);
}

/* ✗ Treating user and agent as the same color */
.user-message, .agent-message { border-left-color: var(--brass); }

/* ✓ Use voice tokens */
.user-message  { border-left-color: var(--voice-user); }
.agent-message { border-left-color: var(--voice-agent); }
```
