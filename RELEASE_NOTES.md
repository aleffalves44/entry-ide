# Hermes IDE 1.2.3

The branch you pick is the branch you get. Closing a Claude session
cleans up after itself. The "Select Branch" panel stays open long
enough to actually read.

This is a focused fix-up release on top of 1.2.2 — same Agent mode,
same masthead, just the four sharp edges most users have hit at
least once.

## The branch you pick is now actually used

In the New Session flow, the branch highlighted in the "Select
Branch" step is now applied automatically. Previously, if you didn't
click `Use Branch` inside the per-project panel — which a lot of
people don't, because the panel looks decided — the selection was
silently dropped and your Claude session booted on whatever branch
the project happened to be on, with no isolation.

The highlighted local branch is now propagated the moment the panel
loads. Click another row + `Use Branch` to change it, or just click
`Continue` to accept the default.

When you re-open a project's branch panel to change your mind, it
stays open. Your previously chosen branch is highlighted so you can
see what you picked and either keep it or pick a different one.

## Closing a Claude session tidies up after itself

Closing a Claude session now reliably cleans up its isolated branch
worktree on disk, drops the underlying records, and exits the agent
process cleanly. Before this, the directory and the branch-claim
both lingered, so creating another session on the same branch a few
minutes later would fail with "branch already checked out
elsewhere".

If two sessions share the same branch worktree, closing one of them
leaves the directory in place — the other session is still using it.

## Failed isolation surfaces an error instead of silently regressing

If branch isolation can't be set up for every project you attached
(for example: the branch is already checked out elsewhere, the disk
is full, or you don't have permission to write the worktree
location), the New Session flow now stops with a clear error
instead of starting your agent in the project root and pretending
nothing happened.

Partial failures still proceed — the projects that did get
isolation will work normally, and the ones that didn't are called
out.

## Converting a terminal session to Claude keeps your branch

Right-clicking a terminal session and choosing **Convert to
Claude** now preserves the isolated branch you were working on,
instead of leaving the new agent in the project root.

## Bug fixes

- The branch selector panel no longer snaps shut immediately when
  you re-open it to change your selection.
- Closing a Claude session no longer leaves an orphan Node process
  in your activity monitor.
- The "Discard changes" choice in the close-confirmation dialog
  correctly leaves shared work alone when another session is still
  using the same branch.
