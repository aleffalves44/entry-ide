import { useState, useEffect, useMemo, type ReactNode } from "react";
import { gitDiff } from "../api/git";
import { useSession } from "../state/SessionContext";
import { getLanguageSupport, getLanguageForExtension } from "../editor/languageRegistry";
import { highlightTree, classHighlighter } from "@lezer/highlight";
import type { LanguageSupport } from "@codemirror/language";
import type { GitFile, GitDiff } from "../types/git";
import "../styles/components/GitPanel.css";
import "../styles/components/GitDiffView.css";

// ─── Diff parsing (exported for tests) ─────────────────────────────────

export interface DiffLine {
  type: "add" | "del" | "ctx";
  /** Line content without the leading +/-/space marker. */
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

/** Parses a unified diff into hunk groups with typed, numbered lines. */
export function parseDiffHunks(diffText: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const raw of diffText.split("\n")) {
    if (raw.startsWith("@@")) {
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      oldLine = m ? parseInt(m[1], 10) : 1;
      newLine = m ? parseInt(m[2], 10) : 1;
      current = { header: raw, lines: [] };
      hunks.push(current);
    } else if (!current) {
      continue; // file headers before the first hunk
    } else if (raw.startsWith("+")) {
      current.lines.push({ type: "add", text: raw.slice(1), oldLine: null, newLine: newLine++ });
    } else if (raw.startsWith("-")) {
      current.lines.push({ type: "del", text: raw.slice(1), oldLine: oldLine++, newLine: null });
    } else if (raw.startsWith(" ")) {
      current.lines.push({ type: "ctx", text: raw.slice(1), oldLine: oldLine++, newLine: newLine++ });
    }
    // "\ No newline at end of file" and the trailing empty split entry are skipped.
  }

  // Untracked files come back as bare "+" lines with no @@ header —
  // synthesize a single hunk so side-by-side rendering still works.
  if (hunks.length === 0 && diffText.length > 0) {
    const synthetic: DiffHunk = { header: "", lines: [] };
    let n = 1;
    for (const raw of diffText.split("\n")) {
      if (raw.startsWith("+")) {
        synthetic.lines.push({ type: "add", text: raw.slice(1), oldLine: null, newLine: n++ });
      }
    }
    if (synthetic.lines.length > 0) hunks.push(synthetic);
  }

  return hunks;
}

// ─── Word-level diff (exported for tests) ──────────────────────────────

export interface WordToken {
  type: "same" | "add" | "del";
  text: string;
}

function tokenizeLine(line: string): string[] {
  return line.match(/\w+|\s+|[^\w\s]+/g) ?? [];
}

/** Guard against quadratic LCS blowup on very long lines. */
const MAX_LCS_CELLS = 10_000;

/**
 * Word-level diff between a deleted and an added line.  Tokens shared
 * between both sides are `same`; divergent tokens are `del` on the old
 * side and `add` on the new side.
 */
export function parseWordDiff(
  delLine: string,
  addLine: string,
): { del: WordToken[]; add: WordToken[] } {
  const a = tokenizeLine(delLine);
  const b = tokenizeLine(addLine);
  if (a.length === 0 && b.length === 0) return { del: [], add: [] };

  if (a.length * b.length > MAX_LCS_CELLS) {
    // Too long for word-level comparison — mark whole lines as changed.
    return {
      del: delLine ? [{ type: "del", text: delLine }] : [],
      add: addLine ? [{ type: "add", text: addLine }] : [],
    };
  }

  // Standard LCS table over tokens.
  const m = a.length;
  const n = b.length;
  const table: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const del: WordToken[] = [];
  const add: WordToken[] = [];
  const push = (list: WordToken[], type: WordToken["type"], text: string) => {
    const last = list[list.length - 1];
    if (last && last.type === type) last.text += text;
    else list.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      push(del, "same", a[i]);
      push(add, "same", b[j]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push(del, "del", a[i++]);
    } else {
      push(add, "add", b[j++]);
    }
  }
  while (i < m) push(del, "del", a[i++]);
  while (j < n) push(add, "add", b[j++]);

  return { del, add };
}

// ─── Syntax highlighting (per line, via lezer classHighlighter) ────────

interface StyledRange {
  from: number;
  to: number;
  className: string | null;
}

function highlightRanges(text: string, lang: LanguageSupport | null): StyledRange[] {
  if (!lang || !text) return [{ from: 0, to: text.length, className: null }];
  const ranges: StyledRange[] = [];
  let pos = 0;
  try {
    const tree = lang.language.parser.parse(text);
    highlightTree(tree, classHighlighter, (from, to, classes) => {
      if (from > pos) ranges.push({ from: pos, to: from, className: null });
      ranges.push({ from, to, className: classes });
      pos = to;
    });
  } catch {
    return [{ from: 0, to: text.length, className: null }];
  }
  if (pos < text.length) ranges.push({ from: pos, to: text.length, className: null });
  return ranges;
}

/** Char ranges of a line covered by changed (non-`same`) word tokens. */
function changedRanges(tokens: WordToken[]): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  let pos = 0;
  for (const t of tokens) {
    if (t.type !== "same") out.push({ from: pos, to: pos + t.text.length });
    pos += t.text.length;
  }
  return out;
}

/**
 * Renders one line of code with syntax highlighting, optionally wrapping
 * the word-diff ranges in `<mark>` elements.
 */
function renderLineContent(
  text: string,
  lang: LanguageSupport | null,
  wordTokens?: WordToken[],
  markClass?: string,
): ReactNode {
  if (text.length === 0) return " ";
  const syntax = highlightRanges(text, lang);
  const marks = wordTokens ? changedRanges(wordTokens) : [];

  // Split at every syntax and word-mark boundary, then emit spans.
  const bounds = new Set<number>([0, text.length]);
  for (const r of syntax) {
    bounds.add(r.from);
    bounds.add(r.to);
  }
  for (const r of marks) {
    bounds.add(r.from);
    bounds.add(r.to);
  }
  const points = [...bounds].sort((x, y) => x - y);

  const nodes: ReactNode[] = [];
  for (let k = 0; k < points.length - 1; k++) {
    const from = points[k];
    const to = points[k + 1];
    if (from >= to) continue;
    const slice = text.slice(from, to);
    const cls = syntax.find((r) => r.from <= from && r.to >= to)?.className ?? null;
    const marked = marks.some((r) => r.from <= from && r.to >= to);
    const span = cls ? <span key={k} className={cls}>{slice}</span> : slice;
    nodes.push(marked && markClass ? <mark key={k} className={markClass}>{span}</mark> : span);
  }
  return nodes;
}

// ─── Del/add pairing for word-level diff ────────────────────────────────

/** Maps hunk-line index → word tokens, pairing del runs with add runs. */
function buildWordDiffMap(hunk: DiffHunk): Map<number, WordToken[]> {
  const map = new Map<number, WordToken[]>();
  let i = 0;
  while (i < hunk.lines.length) {
    if (hunk.lines[i].type !== "del") {
      i++;
      continue;
    }
    const delStart = i;
    while (i < hunk.lines.length && hunk.lines[i].type === "del") i++;
    const addStart = i;
    while (i < hunk.lines.length && hunk.lines[i].type === "add") i++;
    const pairs = Math.min(i - addStart, addStart - delStart);
    for (let p = 0; p < pairs; p++) {
      const delIdx = delStart + p;
      const addIdx = addStart + p;
      const { del, add } = parseWordDiff(hunk.lines[delIdx].text, hunk.lines[addIdx].text);
      map.set(delIdx, del);
      map.set(addIdx, add);
    }
  }
  return map;
}

// ─── Side-by-side row pairing ───────────────────────────────────────────

interface SideRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

function buildSideRows(hunk: DiffHunk): SideRow[] {
  const rows: SideRow[] = [];
  let i = 0;
  while (i < hunk.lines.length) {
    const line = hunk.lines[i];
    if (line.type === "ctx") {
      rows.push({ left: line, right: line });
      i++;
      continue;
    }
    const delStart = i;
    while (i < hunk.lines.length && hunk.lines[i].type === "del") i++;
    const addStart = i;
    while (i < hunk.lines.length && hunk.lines[i].type === "add") i++;
    const dels = hunk.lines.slice(delStart, addStart);
    const adds = hunk.lines.slice(addStart, i);
    const span = Math.max(dels.length, adds.length);
    for (let r = 0; r < span; r++) {
      rows.push({ left: dels[r] ?? null, right: adds[r] ?? null });
    }
  }
  return rows;
}

// ─── Component ──────────────────────────────────────────────────────────

interface GitDiffViewProps {
  sessionId: string;
  projectId: string;
  file: GitFile;
  onClose: () => void;
  /** `modal` (default): overlay + backdrop-click close.  `inline`: bare
   *  panel for embedding in the side viewer next to the chat. */
  variant?: "modal" | "inline";
}

export function GitDiffView({ sessionId, projectId, file, onClose, variant = "modal" }: GitDiffViewProps) {
  const { state, dispatch } = useSession();
  const viewMode = state.ui.diffViewMode;

  const [diff, setDiff] = useState<GitDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStaged, setShowStaged] = useState(file.area === "staged");

  // Reset the staged toggle when switching files.
  useEffect(() => {
    setShowStaged(file.area === "staged");
  }, [file.path, file.area]);

  useEffect(() => {
    let cancelled = false;
    // 2F: Clear old diff immediately before fetching new one
    setDiff(null);
    setLoading(true);
    setError(null);
    gitDiff(sessionId, projectId, file.path, showStaged)
      .then((d) => { if (!cancelled) { setDiff(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [sessionId, projectId, file.path, showStaged]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const language = useMemo(() => {
    const ext = file.path.split(".").pop() ?? "";
    return getLanguageSupport(getLanguageForExtension(ext));
  }, [file.path]);

  const hunks = useMemo(
    () => (diff && !diff.is_binary ? parseDiffHunks(diff.diff_text) : []),
    [diff],
  );

  const showBinary = diff ? diff.is_binary && !diff.truncated : false;
  const showTruncatedBanner = diff ? diff.truncated && !diff.is_binary : false;
  const canToggleStaged = file.status !== "untracked";

  const renderUnifiedHunk = (hunk: DiffHunk, hi: number) => {
    const wordMap = buildWordDiffMap(hunk);
    return (
      <div key={hi}>
        {hunk.header && <div className="git-diff-line git-diff-line-hunk">{hunk.header}</div>}
        {hunk.lines.map((line, li) => {
          const cls =
            line.type === "add" ? "git-diff-line git-diff-line-add"
            : line.type === "del" ? "git-diff-line git-diff-line-del"
            : "git-diff-line";
          const markClass = line.type === "add" ? "git-diff-word-add" : "git-diff-word-del";
          const prefix = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
          return (
            <div key={li} className={cls}>
              {prefix}
              {renderLineContent(line.text, language, wordMap.get(li), markClass)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSideBySideHunk = (hunk: DiffHunk, hi: number) => {
    const wordMap = buildWordDiffMap(hunk);
    const indexOf = new Map<DiffLine, number>(hunk.lines.map((l, idx) => [l, idx]));
    const rows = buildSideRows(hunk);

    const renderCell = (line: DiffLine | null, side: "left" | "right") => {
      if (!line) return <div className="git-diff-line git-diff-line-empty">&nbsp;</div>;
      const isChanged = line.type !== "ctx";
      const cls = !isChanged
        ? "git-diff-line"
        : side === "left" ? "git-diff-line git-diff-line-del" : "git-diff-line git-diff-line-add";
      const markClass = side === "left" ? "git-diff-word-del" : "git-diff-word-add";
      const tokens = isChanged ? wordMap.get(indexOf.get(line) ?? -1) : undefined;
      return (
        <div className={cls}>
          {renderLineContent(line.text, language, tokens, markClass)}
        </div>
      );
    };

    return (
      <div key={hi}>
        {hunk.header && <div className="git-diff-line git-diff-line-hunk">{hunk.header}</div>}
        <div className="git-diff-side-by-side">
          <div className="git-diff-side-col">
            {rows.map((row, ri) => <div key={ri}>{renderCell(row.left, "left")}</div>)}
          </div>
          <div className="git-diff-side-col">
            {rows.map((row, ri) => <div key={ri}>{renderCell(row.right, "right")}</div>)}
          </div>
        </div>
      </div>
    );
  };

  const body = (
    <div
      className={variant === "modal" ? "git-diff-modal" : "git-diff-modal git-diff-inline"}
      onClick={variant === "modal" ? (e) => e.stopPropagation() : undefined}
    >
      <div className="git-diff-header">
        <span className="git-diff-path">{file.path}</span>
        {diff && !diff.is_binary && (
          <span className="git-diff-stats">
            <span className="git-diff-additions">+{diff.additions}</span>
            <span className="git-diff-deletions">-{diff.deletions}</span>
          </span>
        )}
        {canToggleStaged && (
          <div className="git-diff-staged-toggle" role="group" aria-label="Diff source">
            <button
              className={showStaged ? "git-diff-staged-toggle-btn" : "git-diff-staged-toggle-btn active"}
              onClick={() => setShowStaged(false)}
            >
              Unstaged
            </button>
            <button
              className={showStaged ? "git-diff-staged-toggle-btn active" : "git-diff-staged-toggle-btn"}
              onClick={() => setShowStaged(true)}
            >
              Staged
            </button>
          </div>
        )}
        <div className="git-diff-view-toggle" role="group" aria-label="Diff layout">
          <button
            className={viewMode === "unified" ? "git-diff-view-toggle-btn active" : "git-diff-view-toggle-btn"}
            onClick={() => dispatch({ type: "SET_DIFF_VIEW_MODE", mode: "unified" })}
          >
            Unified
          </button>
          <button
            className={viewMode === "side-by-side" ? "git-diff-view-toggle-btn active" : "git-diff-view-toggle-btn"}
            onClick={() => dispatch({ type: "SET_DIFF_VIEW_MODE", mode: "side-by-side" })}
          >
            Split
          </button>
        </div>
        <button className="git-diff-close" onClick={onClose}>&times;</button>
      </div>
      {showTruncatedBanner && (
        <div className="git-diff-truncated-banner">
          <span className="git-diff-truncated-banner-icon">⚠</span>
          <span>Diff too large to display fully — use the terminal for the complete diff.</span>
        </div>
      )}
      <div className="git-diff-content">
        {loading && <div className="git-diff-loading">Loading diff...</div>}
        {error && <div className="git-diff-error">{error}</div>}
        {showBinary && <div className="git-diff-binary">Binary file</div>}
        {diff && !diff.is_binary && (
          <pre className="git-diff-text">
            {viewMode === "side-by-side"
              ? hunks.map(renderSideBySideHunk)
              : hunks.map(renderUnifiedHunk)}
          </pre>
        )}
      </div>
    </div>
  );

  if (variant === "inline") return body;
  return (
    <div className="git-diff-overlay" onClick={onClose}>
      {body}
    </div>
  );
}
