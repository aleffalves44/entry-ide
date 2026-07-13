/**
 * autoLabel — derive a session name from the conversation subject.
 *
 * Applied ONCE, on the session's first user message, and ONLY while the
 * label is still the backend default ("Session N") — a name the user
 * typed (or a previously derived one) is never overwritten.
 */

const MAX_LABEL_LEN = 42;

/** Backend default from create_session: `Session {counter}`. */
export function isDefaultSessionLabel(label: string | null | undefined): boolean {
  return !label || /^Session \d+$/.test(label.trim());
}

/**
 * Derive a label from the first user message.
 *
 *   "/harness-cmd:task CRED-123 arruma o login" → "task CRED-123 arruma o login"
 *   "corrige o bug do checkout que trava"       → "corrige o bug do checkout que…"
 *
 * Returns null when there's nothing meaningful to derive (empty/too
 * short input) — callers keep the current label.
 */
export function deriveSessionLabel(draft: string): string | null {
  const firstLine = (draft ?? "").split("\n")[0].trim();
  if (!firstLine) return null;

  let text = firstLine;
  if (text.startsWith("/")) {
    // Slash command: use the bare command name (drop the plugin prefix)
    // plus its argument — "/harness-cmd:plan CRED-9" → "plan CRED-9".
    const [cmd, ...rest] = text.slice(1).split(/\s+/);
    const bare = cmd.split(":").pop() ?? cmd;
    text = [bare, ...rest].join(" ").trim();
  }
  // Collapse whitespace; strip markdown-ish noise at the edges.
  text = text.replace(/\s+/g, " ").replace(/^[#>*\-\s]+/, "").trim();
  if (text.length < 3) return null;

  if (text.length <= MAX_LABEL_LEN) return text;
  // Cut on a word boundary and mark the truncation.
  const cut = text.slice(0, MAX_LABEL_LEN);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 20 ? lastSpace : MAX_LABEL_LEN).trimEnd()}…`;
}
