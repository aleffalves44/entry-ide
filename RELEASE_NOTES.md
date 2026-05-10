# Hermes IDE 1.1.14

A new dedicated workbench panel for Agent sessions, plus per-session
notes and a few quality-of-life fixes around the file explorer.

## Every Agent session now opens with a workbench on the right

When you open an Agent session, the right side of the window now
hosts a per-session workbench: a file tree on top, a notes drawer at
the bottom, and a Context tab one click away. The workbench opens
by default, takes about half the available width, and remembers its
size and which tab you had open across restarts. Press ⌥⌘B (Alt+
Ctrl+B on Windows/Linux) to toggle it.

The legacy folder icon on the session row is gone for Agent
sessions — the workbench is now the canonical Files surface for
them. Terminal sessions are unchanged.

## A scratchpad lives at the bottom of every Agent session

Each Agent session has its own free-form notes area at the foot of
the workbench: a place for plans, todos, snippets, paste-bin
fragments — anything you'd otherwise lose track of in chat. Notes
save as you type, persist across restarts, and follow the session,
not the window. Switching to a different session pulls up that
session's notes.

## The file tree updates as you attach more folders

When you attached a second folder to an Agent session in 1.1.13, the
file tree didn't pick it up until you reopened the session. The new
folder now appears immediately.

## The Usage panel works again on Agent sessions

In the right activity bar of an Agent session, clicking "Usage" now
opens the plan / limits / cost view as expected. (1.1.13 had a
window where the gate that picked between Workbench and Usage
swallowed the click.)

---

# Hermes IDE 1.1.13

A hotfix for a critical typing bug shipped in 1.1.12.

## The composer no longer locks up and refuses to accept typing

In 1.1.12 the message composer could occasionally stop accepting
keystrokes — you'd see your cursor in the field but nothing would
appear, and the only way to recover was to open a fresh session or
restart the app. The trigger was an interaction between an
international-keyboard or accent-key composition and a focus change
mid-keystroke (clicking another input, switching tabs, pressing
Escape on a half-typed accent), which left the composer convinced
you were still in the middle of an IME composition.

The composer now always commits what you type to the field, and a
focus change resets the composition state defensively, so this state
is no longer reachable.

If you ran into the lockup before, no action is needed; the next
launch of Hermes after updating runs the fixed composer.

---

# Hermes IDE 1.1.12

A performance pass with two bug fixes you'll feel right away.

## New Session opens almost instantly

Clicking "New Session" used to wait roughly a second and a half before
the modal became fully visible and interactive. The cinematic gate has
been trimmed to a brief acknowledgement, and the work that doesn't
matter for the first frame — checking which AI tools are installed,
loading SSH history, scanning past sessions for group colours — only
runs once you've actually picked a path that needs it. The default
Agent flow now opens in a fraction of the old time.

## Bypass mode now works mid-session

Flipping the permission-mode chip into Bypass while a session was
already running would silently fail and the chip would snap back. The
session is now spawned with the capability to enter Bypass on demand,
so the flip takes effect immediately on the next turn. Sessions still
default to whatever permission mode they were created with — nothing
happens unless you ask for it.

## Faster, smoother long sessions

Long Agent conversations stay smooth even at hundreds of messages.
Off-screen messages no longer pay layout and paint cost while you
scroll through history. Streaming responses tax the layout pipeline
once per frame instead of once per token. The vintage thinking
indicator ticks at the cadence its readout actually requires —
tenths-of-a-second precision for the first ten seconds, integer
seconds after — instead of forcing ten redundant updates per second
on every active block.

## Snappier turn rendering

The conversation's turn-number gutter no longer recomputes from
scratch on every streaming token. File-edit diffs render once per
real input change instead of once per re-render. Streaming bash
output no longer attempts to pretty-print the partial buffer as JSON
on every chunk. Each fix is small on its own; together they take a
visible bite out of CPU during heavy turns.

## Database is quicker on every read and write

The local store now opens with desktop-tuned cache and mmap settings
and a relaxed-but-safe write mode under the existing journal. Four
missing indexes were added so the queries that drive the recent
sessions panel, the token-cost panel, and per-project filtering hit
the index instead of scanning. None of this changes how anything
looks; you'll just notice fewer little hitches.

## Better international keyboard input in the composer

Typing CJK characters or accented characters that go through an IME
composition (macOS dead keys, voice dictation, Chinese / Japanese /
Korean input methods) no longer stutters or drops partial codepoints.
The composer now waits for the composition to commit before
processing the input, instead of reacting to every transient codepoint
along the way.
