# 00 · Principles

These are the posture-level decisions. Everything downstream follows from
them. If a token, component, or theme conflicts with one of these, the
token/component/theme is wrong.

## P0 · Hermes is an instrument

The product reads as a workshop instrument, not a panel of switches.
This is the cardinal posture. Chrome is calm, peripheral, and reliable.
Affordances are physical — rails, dials, capsules, ledger entries — not
abstract glyphs floating on a slab.

**Implication:** No flashy gradients on chrome. No purple-on-white. No
"AI chatbot" pastel pairings. The vocabulary is industrial-editorial:
brass, ink, paper, slate.

## P1 · Two voices, never one

Every multi-tone theme distinguishes two voices:

- `--voice-user` — **warm**. The operator's color. Anchors prompts,
  selection bars, and the composer caret.
- `--voice-agent` — **cool**. The agent's color. Anchors assistant
  messages, thinking pulses, and tool focus.

Mono-tone themes (Atelier, Linen, Phosphor) explicitly alias both voices
to the same accent — that aliasing is a deliberate identity choice, not
a default.

**Implication:** A long session shows visible turn rhythm without the
user reading a single word.

## P2 · Chrome whispers; state shouts

The status bar is 95% peripheral, 5% foveal. Static metadata uses
secondary or tertiary text colors and ordinary weights. Color and
animation are reserved for **change of state** — a build became
available, a tool started running, a permission was requested.

**Implication:** A user scanning Hermes pre-attentively sees only what's
new or wrong. Everything else is calm.

## P3 · Density is a user choice, not a developer choice

Components express their height/padding through a `--density-y`
multiplier. Users pick from `compact` / `cozy` / `spacious` in Settings.
A developer hardcoding a panel to `height: 28px` violates this.

## P4 · Themes change tokens; themes never patch components

Adding a new theme means writing an `html[data-theme="..."]` block that
overrides tokens. If a theme needs a per-component CSS override, that's
a missing token — extract it.

This includes archetype paint tokens (`--tool-card-bg`,
`--turn-separator`, `--surface-grain-opacity`, etc.) which let each
theme pick one of the six rendering archetypes without component code
caring.

## P5 · Accessibility is non-negotiable

Every text token declares a minimum contrast ratio. Every focusable
element has a visible focus ring on every theme. Motion respects
`prefers-reduced-motion`. WCAG AA is the floor — for text and UI
controls, never below 4.5:1 (3:1 for ≥18px or bold ≥14px).

## P6 · One brand of motion

All transitions use one of four durations (`tap` / `quick` / `base` /
`slow`) and one of four easings (`out-expo` / `out-soft` / `spring` /
`standard`). Hand-rolled `cubic-bezier(...)` in component CSS is a code
smell; route through the tokens.

## P7 · Editorial typography earns its keep

The product loads three fonts (Inter Tight, JetBrains Mono, Newsreader).
All three render on every theme. Newsreader is not "WebFetch-only"; it
is the masthead voice for editorial themes and the blockquote voice
everywhere. A font we ship and don't use is wasted bytes and wasted
identity.

## P8 · Real reading happens here

The agent surface is fundamentally a long-form structured reading
experience. Body prose uses generous leading (`--leading-relaxed`), a
true editorial heading scale, and a measure capped at 76ch. Treating it
like a Slack channel — narrow leading, weak heading hierarchy, no
measure cap — is wrong.

## P9 · Progressive disclosure inside the sidebar

The session list shows enough metadata to scan, hides the rest until
hover/active. The sidebar is an index, not a wall of metadata.

## P10 · No empty containers

If a component renders a container that visually exists (border,
background, padding) but contains no content, that is a bug. Either the
container collapses to its content (a chip), or the content lives inside
the container (a card). The pre-fix `ThinkingBlock` violated this — its
container always rendered even when the body was hidden, causing the
body to look like it had escaped.
