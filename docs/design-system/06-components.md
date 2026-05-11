# 06 · Components

## ThinkingBlock

**Posture:** A thinking trace is a footnote attached to a message, not a
free-standing container.

**Rules:**
1. Collapsed state renders only the **chip** — no full-width container.
2. The chip carries the elapsed counter and a disclosure caret.
3. Expanded state renders the body **inside** the chip's footprint (the
   chip flips into a card flush with the speaker rail).
4. The block lives within the assistant message's left rail — there is a
   visible parent–child relationship.

```tsx
<div className={`agent-thought ${open ? "is-open" : ""}`}>
  <button className="agent-thought-chip" onClick={...}>
    <span className="agent-thought-dot" aria-hidden="true" />
    {live ? "thinking" : "thought"}
    {elapsedLabel && <span className="agent-thought-elapsed"> · {elapsedLabel}</span>}
    <span className="agent-thought-caret" aria-hidden="true">{open ? "▾" : "›"}</span>
  </button>
  {open && <pre className="agent-thought-body">{block.thinking}</pre>}
</div>
```

**Anti-pattern:** Rendering the dashed container unconditionally so it
appears as an empty box when collapsed. (The pre-fix bug.)

## Status bar

**Structure:** Three zones with `--rule-zone` dividers.

```html
<footer class="status-bar">
  <!-- Zone 1 · Identity -->
  <span class="status-branch">main</span>
  <span class="status-version-chip" data-state="idle">v1.1.16</span>
  <div class="status-zone-rule" />

  <!-- Zone 2 · Session state -->
  <span class="status-capsule" data-state="busy">...</span>
  <div class="status-mode-segmented" role="radiogroup">...</div>
  <div class="status-zone-rule" />

  <!-- Zone 3 · Metrics -->
  <span class="status-tokens">14,238 tok</span>
  <span class="status-cost">$0.42</span>
  <span class="status-elapsed">4:12</span>
</footer>
```

### Status capsule (busy / needs-input)

A pill with a breathing dot + tracked uppercase label. Slow shimmer
sweeps across the pill while busy.

### Mode segmented control

Three flush pill-segments: `[Manual · Assisted · Auto]`. Active segment
filled with its mode color, inactive segments are ghost labels with no
fill. Replaces cycle-on-click — users always see all three options.

### Version chip (4 states)

One element, four states (`data-state`): `idle` / `checking` /
`available` / `downloading`. In `downloading`, the border is a
clockwise progress arc (conic gradient + radial mask).

### Color discipline

Static metadata uses `--text-2`. Color is reserved for change-of-state:
- `--success` on busy
- `--warning` on needs-input
- `--voice-user` flash on cost-just-changed (fades back to `--text-2` over 1.5s)
- `--danger` on error

## Activity bar

**Posture:** Cardinal landmark. Never bobs, never shifts, always
anchored.

**Rules:**
1. Icon geometry is frozen — hover only reveals a horizontal label
   pop-out beside the icon.
2. A single `--rail` element travels between active tabs (spring easing).
3. Badges are 14px brass-ringed counters that float top-right of the
   icon with a heartbeat pulse when the value increases.
4. The pinned group and reorderable group are separated by an etched
   1px groove (not a flat separator).

**Anti-pattern:** Per-tab `::before` accent rectangles that flicker on
state change; hover-height changes that shift neighboring tabs.

## Session list

**Row composition:** Two zones.
1. Identity — name + (optional, hidden by default) description
2. State — git row + monogram glyphs + phase tag (hidden when row inactive)

**Phase signal lives on the color band** (3px wide, full row height):
- `idle` — solid voice color
- `busy` — vertical shimmer
- `needs_input` — amber pulse
- `error` — solid danger

**Monograms** replace the previous agent and SSH tag chips: a single
14px brass-ringed glyph (`C` for Claude, `◍` for SSH, etc.) tucked next
to the name.

**Skeletons during boot:** ruled-paper stripes with brass-tinted
shimmer fill the row positions while data hydrates.

## Composer

**Send pill:** A 34px brass circular button anchored bottom-right of the
composer card with a paper-plane glyph. States:

- **disabled** — hollow ring, no fill
- **armed** — brass fill, raised shadow
- **submitting** — thin animated arc rotates around the rim
- **hover (armed)** — a small `⌘⏎` kbd hint appears beneath

**Measure cap:** content area is capped at `max-width: 76ch` and
centered within the pane. The wrapper background bleeds full-width.

**Focus state:** the card lifts via `--shadow-2` + `--focus-ring-shadow`,
border becomes `--focus-ring` color.

## Empty state · Logbook

**Row composition:** Two lines per entry.
1. Top line — № number, color dot, title, project, time-ago
2. Bottom line — last-prompt snippet + meta chips (model, message count,
   cost)

On hover, a 1px brass page-edge appears on the left and the arrow slides
4px right with a brass tint. Maintains the editorial / workshop tone.

## Agent surface

**Voice rails:** Every message has a left rail in its voice color:
- User messages — `--voice-user` (warm)
- Assistant messages — `--voice-agent` (cool)

**Heading scale:** See [01-typography.md](./01-typography.md). h1 24px /
h2 20px / h3 16px / h4 14px tracked uppercase.

**Blockquotes:** Always Newsreader, italic, opsz 14, with a 2px left
rule in `--rule-strong`.

**Message entry:** 220ms opacity + translateY(6px) on first mount only.

## Tool blocks

**Header:** title + status indicator + **elapsed counter** + **probabilistic arc**

The elapsed counter mirrors the ThinkingBlock format (tenths under 10s,
integer seconds above). The arc fills clockwise to the rolling p50
duration of past invocations for that tool family. Unknown tools get a
pulse-then-decay rhythm that visibly slows over time.

## Modals, popovers, command palette

Use `--bg-elevated` + `--shadow-3` (popover) or `--shadow-4` (dialog)
+ `--radius-lg`. No hand-rolled shadows.

Enter animation: `var(--dur-slow) var(--ease-out-expo)` opacity + scale.

## Bad patterns to avoid

```tsx
/* ✗ Container that's empty when collapsed */
<div className="thinking-block-container">  {/* dashed border, padding */}
  <Toggle />
  {open && <Body />}
</div>

/* ✓ Chip collapses to its content */
<div className={`thought ${open ? "is-open" : ""}`}>
  <button className="thought-chip">...</button>      {/* the visible element when collapsed */}
  {open && <pre className="thought-body">...</pre>}
</div>
```
