# Hermes IDE 1.2.2

See exactly what your sub-agents are doing, watch Claude reason in
real time, and notice when your checklist drifts.

## See your sub-agents at a glance

When Claude dispatches sub-agents in parallel, each one now shows up
as a clean, compact row under its parent — name, state dot, elapsed
time, and a quiet `(+N)` hint if it spawned more sub-agents of its
own. Click any row to read its final reply; the metadata strip
underneath reveals token counts and the agent ID for the times you
need to dig in.

A small **`● N subagents ▾`** pill appears in the session header
whenever sub-agents are running. Click it to open a popover of every
active sub-agent across the session, nested by depth. Click any row
to jump back to where it was dispatched.

No more wall of identical tool-use cards. No more losing track of who
is doing what.

## Watch Claude work in real time

The old flashing-cursor experience is gone. In its place: two new
surfaces pinned to the bottom of every Claude session.

A **status line** shows the present-tense verb and what Claude is
acting on — `reading src/foo.ts`, `running grep -rn …`,
`coordinating 2 of 3 subagents`, `drafting reply · ~620 tokens` —
alongside a chronograph, a token counter, and a `Stop` button (or
just press Esc). When you've been waiting a while on the first byte,
the line escalates its copy from "first byte" to "negotiating with
the API" to "long context, may take 30–60s" so you know the IDE
isn't hung.

A **rolling preview rail** above the status line shows the last two
sentences of Claude's narration as it's being written. When Claude
is thinking before its first byte, the rail surfaces what it's
responding to so you always have context.

## Live thinking, finally readable

Thinking blocks now **auto-open while Claude is reasoning** and
auto-collapse once the turn ends. While streaming, the body fills
sentence-by-sentence with a small brass pulse at the tail showing
the live edge. Click the chip any time to pin it open (or closed) —
your preference sticks for the rest of that block.

The conversation pane **auto-scrolls to follow** the growing
reasoning, exactly like it does for the final answer. Scroll up to
re-read and we leave you alone — scroll back down and the
auto-follow re-engages.

## Bug fixes

- **Numbered answers like `4.` no longer render as `1.`** — the
  rendered text now honours the actual number the model produced.
- **Esc reliably stops the current turn** when focus is anywhere
  outside an input or textarea, and the visual variant of the
  status line briefly turns red-striped while we flush partial
  output.

## Notice when your TODO list drifts

The TODO panel now flags when Claude has gone three or more turns
without refreshing the list. A quiet brass dot in the header reads
**`STALE · *3 turns ago*`** — no alarms, just a heads-up that the
checklist may not reflect what the agent is actually doing right now.

You can also mark any row done yourself: hover the row, click the
**`✓`**. The override is local — your finger on the scale, not a
message to the agent — and it clears the moment the agent writes a
fresh list. Useful when you've completed a step but the agent forgot
to tick it.

## A few editorial touches

- The **in-progress** TODO glyph is now `❯`, distinct from the
  expand-disclosure `▸` it used to share. One shape per meaning.
- Sub-agent rows and the masthead chip **fade in** instead of
  popping, matching the rest of the IDE's motion vocabulary.
  Respects your system "reduce motion" preference.
- Status words ("done", "running", "thinking") render in **italic**
  — editorial register for the captions, mono numbers for the facts.
- The masthead popover is now **opaque on every theme** — no more
  conversation bleeding through when you check the running list.
- A thin brass thread connects each sub-agent's state dot down to
  its expanded body, so the eye reads the row and its detail as
  one continuous instrument.
