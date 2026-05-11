# Hermes IDE 1.2.0

A redesigned conversation surface, a cleaner composer, and a calmer
status bar. The same eight themes, all sharing a new visual language:
a warm voice for your turns, a cool voice for the agent's, a real type
system, and an actual motion vocabulary.

## Two voices, finally distinguishable

Every theme now declares a **warm tone for the operator** (your prompts,
your composer, the user-message bar) and a **cool tone for the agent**
(assistant messages, thinking pulses, tool focus). A long conversation
now reads at a glance — you can see your turns versus the agent's
without reading a single word.

Mono-tone themes (Atelier, Linen, Phosphor) keep their single accent on
purpose; everywhere else you'll see a clear duotone. Newsprint in
particular is now a real broadsheet duotone — brass becomes the live
accent for links and selection, while true ink stays as the body color.

## A real type system

Agent markdown headings now have a proper editorial hierarchy — 24 / 20 /
16 / 14 — so the structure in long replies is actually scannable.
Editorial themes (Atelier, Linen, Observatory, Newsprint) render those
headings in Newsreader serif, the typeface that previously only showed up
in web-fetch excerpts.

The whole app rebases its size and weight ladder on a modular 1.125 scale
rooted at 13px. Chrome text is one step bigger and easier to read; tracked
uppercase labels get the spacing they need at small sizes.

## The composer, rethought

The settings row at the bottom of the composer is no longer a wall of
labeled pills. Model, Permission, and Effort are now compact dot-chips —
a small colored dot identifies the slot, the value sits next to it.

**Bypass mode now announces itself** — the Permission chip turns red and
its dot pulses when you're running without confirmation. Previously
Bypass was just another grey pill among five.

The **Send** button is now a brass pill that reads `Send →` with the
arrow sliding right on hover. The keyboard shortcut moved into the
tooltip so the button can breathe.

The composer also gained an **explicit Attach button** for adding images.
Paste and drag-and-drop continue to work; you can now click a button too.

When you press Esc with an empty draft, the minimized composer is now a
**discoverable brass pill labeled "Compose"** with the keyboard shortcut
visible, instead of a tiny circle hugging the corner.

## A calmer status bar

The "working" and "needs input" labels are now **pulsing capsules** with
shape and color — your peripheral vision will catch them without you
looking down.

The execution mode toggle is now a **3-segment control** showing Manual /
Assisted / Auto at once. No more cycle-on-click guessing about which
mode you're switching to.

The version chip collapses four states into one element: idle, checking,
update available, and downloading-with-progress (the border becomes a
progress arc).

Token count, cost, and elapsed time settle to calm grey by default and
flash brass briefly when they change — you notice movement, not stillness.

## The activity bar stays put

Hovering an icon in the activity bar no longer shifts its neighbours.
The active-tab indicator now travels smoothly between tabs and the icons
themselves are bigger.

## Session list reads more clearly

Each session row's left band now carries its live state — a slow vertical
shimmer when busy, an amber pulse when it needs input, solid red on error.
The agent and SSH tag chips are replaced with single-letter monogram
glyphs next to the session name. Description and project chips hide on
inactive rows so the sidebar reads as a glanceable index.

## The "thought" block is no longer empty

In agent conversations, the collapsed "thought" footnote previously
rendered as an empty dashed box with its content appearing below it.
Collapsed thoughts are now a small brass chip; expanded thoughts pull
their body inside the same footprint. You see the reasoning trace
exactly where you'd expect it.

## More legible light themes

Text contrast on Frosted Light, Atrium, and Linen now meets WCAG AA.
Secondary metadata in those themes was previously hard to read.

## More atmosphere

Frosted Dark and Frosted Light carry a faint cool tint so the frosted
overlays have something to refract — the default theme finally has
weather. Atrium gains a richer slate-teal accent; the previous muted
slate didn't pop on the daylight surface.

Every theme also has a tailored focus ring — a soft halo on glass
themes, a sharp double-rule on Newsprint that survives any backdrop,
an accent glow on Phosphor, brass on the editorial family.

## Tab strips slide

Switching between Terminal and Git tabs now uses a smoothly sliding
underline instead of a snap.

## Logbook entries get a preview

The "Logbook" of recent sessions on the empty-state page now shows a
preview snippet and shell name for each session, alongside the title
and time-ago. Hover slides a brass page-edge in from the left.

## A documented design system

This release also lands a comprehensive design-system documentation
suite recording every token, rule, and component pattern — the same
foundation 1.2.0 is built on. New contributors and new themes can
build on top of it.

---

# Hermes IDE 1.1.15

A redesigned theme system. Eight themes, one identity.

## Eight themes, four dark and four light, each with a distinct mood

Hermes shipped with thirty themes through 1.1.14, fragmenting the
visual identity. This release consolidates the catalog to eight,
each with a clear mood and shared design grammar — the same triple-
font system, the same brass-rail accents, the same editorial layout.
What varies between them is feeling, not vocabulary.

The dark themes are **Frosted Dark** (Apple-y modernist, the new
default), **Atelier** (warm cocoa with terracotta accent),
**Observatory** (deep navy with true brass — the strongest Hermes
identity), and **Phosphor** (CRT green-on-black with scanlines, for
the terminal soul).

The light themes are **Frosted Light** (clean Apple-y light),
**Linen** (warm cream paper with sepia ink), **Newsprint** (high-
contrast off-white broadside), and **Atrium** (soft daylight blue-
gray for long sessions).

## Existing themes are migrated, not lost

If you were using one of the twenty-two retired themes, Hermes will
quietly switch you to its closest cousin on first launch — Hacker
becomes Phosphor, Midnight becomes Observatory, Solarized Dark
becomes Atelier, Lavender and Mint become Atrium, and so on. Your
preference is then re-saved with the new name, so the switch happens
once and never again.

Embedded terminals now match the chrome too — pick Atelier and your
shell goes warm cocoa, pick Phosphor and it goes CRT green.

## Onboarding and Settings show only the eight that exist

The first-run theme picker, the Settings drawer, and the status-bar
theme switcher all reflect the new catalog. No more scrolling through
a list of thirty options trying to remember which one was which.

---

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
