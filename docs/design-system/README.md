# Entry IDE · Design System

This folder is the canonical source of truth for Entry IDE's visual language.
It defines the tokens, components, and rules that the whole product follows so
that any change — new feature, new theme, new contributor — stays coherent
with the rest of the surface.

## Why this exists

Entry is an instrument, not a panel of switches. Every visual decision
either reinforces that posture or quietly erodes it. The design system makes
the rules explicit so that:

1. **New components** can be built without reinventing spacing, color, or
   motion language.
2. **New themes** can be authored by overriding tokens — never by patching
   component CSS.
3. **Reviewers** have a shared rubric to push back on drift ("this hardcodes
   `0.5px`; route it through `--tracking-widest`").
4. **Future contributors** can read one folder instead of reverse-engineering
   intent from 90+ CSS files.

## How to use this folder

| Document                       | What it covers                                                             |
| ------------------------------ | -------------------------------------------------------------------------- |
| [00-principles.md](./00-principles.md) | Posture, philosophy, the "instrument over panel" rule.            |
| [01-typography.md](./01-typography.md) | Type scale, weights, leading, tracking, optical sizing, font roles. |
| [02-color.md](./02-color.md)           | Color tokens, semantic ramps, voice tokens (user/agent), contrast contract. |
| [03-spacing-density.md](./03-spacing-density.md) | Spacing tokens, density multiplier, panel snap grid, divider hierarchy. |
| [04-elevation.md](./04-elevation.md)   | Shadow ramp, surface elevation, theme-tinted shadows.              |
| [05-motion.md](./05-motion.md)         | Easing curves, duration scale, micro-interaction patterns.         |
| [06-components.md](./06-components.md) | Component-level rules: composer, status bar, activity bar, session list, agent surface. |
| [07-accessibility.md](./07-accessibility.md) | Contrast contract, focus rings, motion sensitivity, kbd affordance. |
| [08-tokens-reference.md](./08-tokens-reference.md) | Flat reference of every token, value, and intended usage.    |
| [09-migration.md](./09-migration.md)   | Migration from pre-redesign tokens, deprecation aliases, lint rules. |

## The non-negotiable rules

These are the principles that override any local convenience:

1. **Tokens before values.** Raw pixel/hex values in component CSS are a
   smell. If a value doesn't exist as a token, propose adding one; do not
   reach for `5px` because the closest token is `4px`.
2. **One brand of motion.** All transitions use a token-defined easing and
   duration. No bespoke `cubic-bezier(...)` in component files.
3. **One brand of elevation.** Floating surfaces use the shadow tokens —
   never hand-rolled multi-stack `box-shadow` strings.
4. **Contrast contract is law.** Every text token has a documented minimum
   contrast ratio it MUST satisfy on every theme. PRs that break the
   contract fail review.
5. **Voice colors carry meaning.** The user voice (warm) and agent voice
   (cool) are distinct in every multi-tone theme. Treating them as the same
   color outside of mono-tone themes (Atelier, Linen, Phosphor) is wrong.
6. **Themes change tokens. Themes do not patch components.** A new theme
   that needs a per-component CSS override is a missing token.

## Authority

When this folder disagrees with a comment in a CSS file, this folder wins.
File-level comments age; this folder is updated as the rules evolve.

When the implementation disagrees with this folder, the implementation is
wrong (or the document needs an amendment — open a PR).

## Provenance

The system was compiled in 2026 Q2 from a five-discipline audit:

- Typography & visual design
- Layout & spatial composition
- Color, theme & atmosphere
- Component patterns & affordances
- Motion design & micro-interactions

34 proposals were synthesized into the rules below. The original audit
mockup is preserved at `/tmp/entry-ui-audit/index.html` for reference.
