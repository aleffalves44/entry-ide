// @vitest-environment jsdom
/**
 * Regressions pinned by these tests
 * ─────────────────────────────────
 *
 * Several visual / interaction bugs landed in the big 1.1.x design-system
 * merge.  None of them had unit-test coverage at the time, which is what
 * let them ship.  Each describe-block below is named after the
 * user-visible symptom + the structural invariant that has to hold for
 * the fix to keep working:
 *
 *   - Composer attachment row keeps breathing room below image
 *     thumbnails (previously `padding-bottom: 0`, which made the
 *     thumbnail visually crash into the textarea below).
 *
 *   - CodeFence "Show more / Show less" toggles render OUTSIDE the
 *     `<pre>` scroll container.  When they lived inside the pre,
 *     `position: absolute; left: 50%` resolved against the SCROLL
 *     content width — for wide code blocks that put the click target
 *     off-screen, and clicking it triggered the browser's
 *     scroll-focused-element-into-view pass which yanked the content
 *     sideways and made the button "drift" out from under the cursor.
 *     Many clicks were needed to land one that registered.
 *
 * The tests are platform-agnostic — they read the source CSS file and
 * the rendered DOM tree.  They run identically on Linux, macOS, and
 * Windows CI runners.
 */
import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { CodeFence } from "../agent/blocks/CodeFence";

afterEach(() => cleanup());

// `import.meta.url` is the test file; resolve repo-relative paths from it
// so the test works on every OS (Windows path separators included — Node
// handles the conversion internally when we pass a file:// URL).
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(HERE, "..");

function readSrc(rel: string): string {
  return readFileSync(resolve(SRC_ROOT, rel), "utf8");
}

/** Strip C-style block comments (`/* ... *​/`) so a rule-body parser
 *  doesn't get fooled into thinking commented-out declarations are
 *  the real ones, or into splitting comment prose on semicolons. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// ─── Problem 3: image attachment bottom padding ───────────────────

describe("SessionComposer.css — pasted-image attachment row has bottom breathing room", () => {
  const css = stripCssComments(readSrc("styles/components/SessionComposer.css"));

  it("`.session-composer-attachments` rule exists", () => {
    expect(css).toMatch(/\.session-composer-attachments\s*\{/);
  });

  it("does NOT collapse the bottom padding to 0", () => {
    // Extract the body of the .session-composer-attachments rule.
    const match = css.match(
      /\.session-composer-attachments\s*\{([^}]*)\}/,
    );
    expect(match, "attachment-row rule must be findable").toBeTruthy();
    const body = match![1]!;

    // Find the `padding:` declaration.  Skip lines starting with `*` so
    // CSS comments don't pollute the match.
    const padding = body
      .split(/;\s*/)
      .map((d) => d.trim())
      .find((d) => /^padding\s*:/.test(d));
    expect(padding, "padding declaration is required").toBeTruthy();

    // Reject the buggy 4-value form that ends in `0` — that was the
    // shipped bug.  Accept the 1-value or 2-value forms (which both
    // give a non-zero bottom), or an explicit 4-value form whose 4th
    // term is a non-zero space token.
    const value = padding!.replace(/^padding\s*:\s*/, "");
    const tokens = value.split(/\s+/);
    const bottomToken =
      tokens.length === 1
        ? tokens[0]
        : tokens.length === 2
          ? tokens[0] // top/bottom shorthand
          : tokens.length === 3
            ? tokens[0] // top, sides, bottom — bottom equals top in 3-value? NO: 3-value is t/h/b — but CSS shorthand says 3 values is top/horizontal/bottom
            : tokens[3]; // 4-value: t r b l
    // Adjust the 3-value mapping per CSS spec (top / horizontal / bottom).
    const bottom =
      tokens.length === 3 ? tokens[2] : tokens.length >= 4 ? tokens[3] : bottomToken;

    expect(bottom).toBeTruthy();
    expect(
      bottom,
      `bottom padding of .session-composer-attachments must not be 0 (got "${value}")`,
    ).not.toBe("0");
    expect(bottom).not.toBe("0px");
  });
});

// ─── Problem: Project-context wizard footer overflows the dialog ─

describe("WorkspacePanel.css — Browse/Scan row stays inside narrow dialogs", () => {
  const css = stripCssComments(readSrc("styles/components/WorkspacePanel.css"));

  it("`.workspace-scan-input` declares `min-width: 0` so the flex parent can shrink it", () => {
    // The input is `flex: 1` and lives in a flex row alongside two
    // small action buttons (Browse, Scan).  Without an explicit
    // `min-width: 0` it defaults to `min-width: auto` (the input's
    // intrinsic ~200px UA width), which refuses to shrink and
    // forces the trailing buttons to overflow the dialog's right
    // edge — exactly the "Scan button not aligned" symptom seen in
    // the New-Session wizard's Project Context step at default
    // panel widths.
    const match = css.match(/\.workspace-scan-input\s*\{([^}]*)\}/);
    expect(match, ".workspace-scan-input rule must exist").toBeTruthy();
    expect(match![1]!).toMatch(/min-width\s*:\s*0/);
  });

  it("`.workspace-scan-btn` declares `flex-shrink: 0` so labels never get clipped", () => {
    // Belt-and-suspenders: even with min-width:0 on the input, we
    // want the action buttons to keep their natural label width and
    // absorb no slack — otherwise a very narrow dialog could squash
    // "Browse" / "Scan" instead of the input.
    const match = css.match(/\.workspace-scan-btn\s*\{([^}]*)\}/);
    expect(match, ".workspace-scan-btn rule must exist").toBeTruthy();
    expect(match![1]!).toMatch(/flex-shrink\s*:\s*0/);
  });
});

// ─── Problem 4: CodeFence Show More button positioning ────────────

describe("CodeFence — collapse/expand button position invariant", () => {
  // Generate 50 lines so the block crosses the collapse threshold (18).
  const longCode = Array.from({ length: 50 }, (_, i) => `line ${i + 1};`).join(
    "\n",
  );

  it("`Show more` button is NOT a descendant of the <pre>", () => {
    // When the button lived inside the <pre>, its absolute positioning
    // resolved against the pre's scrolled content width.  For wide
    // lines the button rendered off-screen and clicks triggered the
    // browser's scroll-focused-into-view pass — the symptom users saw
    // as "the button drifts right and back, takes many clicks".  The
    // fix moves the button out of the pre so it anchors to the
    // surrounding <figure>, which is not a scroll container.
    const { container } = render(<CodeFence code={longCode} language="ts" />);
    const pre = container.querySelector("pre.agent-code-fence-body");
    const button = container.querySelector(".agent-code-fence-show-more");
    expect(pre, "<pre> body must render").toBeTruthy();
    expect(button, "show-more button must render for long code").toBeTruthy();
    expect(pre!.contains(button!)).toBe(false);
  });

  it("`Show more` button IS a descendant of the <figure>", () => {
    const { container } = render(<CodeFence code={longCode} language="ts" />);
    const figure = container.querySelector("figure.agent-code-fence");
    const button = container.querySelector(".agent-code-fence-show-more");
    expect(figure).toBeTruthy();
    expect(button).toBeTruthy();
    expect(figure!.contains(button!)).toBe(true);
  });

  it("the <figure> (offset parent for absolutely-positioned button) is `position: relative` in the source CSS", () => {
    // The button's `position: absolute; left: 50%; bottom: 6px;`
    // depends on the figure being its offset parent — i.e. the figure
    // must be a positioned ancestor.  Without `position: relative` on
    // the figure, the button falls through to the document body and
    // floats away.  Read the CSS source to assert the invariant.
    const css = stripCssComments(
      readSrc("styles/components/agent/AgentSessionView.css"),
    );
    const match = css.match(/\.agent-code-fence\s*\{([^}]*)\}/);
    expect(match, ".agent-code-fence rule must exist").toBeTruthy();
    const body = match![1]!;
    expect(body).toMatch(/position\s*:\s*relative/);
  });

  it("short code (under the collapse threshold) renders NO toggle buttons", () => {
    // Sanity counter-check: the toggle only exists for long blocks.
    const shortCode = "let x = 1;\nlet y = 2;";
    const { container } = render(<CodeFence code={shortCode} language="ts" />);
    expect(container.querySelector(".agent-code-fence-show-more")).toBeNull();
    expect(container.querySelector(".agent-code-fence-show-less")).toBeNull();
    expect(container.querySelector(".agent-code-fence-toggle")).toBeNull();
  });

  it("preserves the centering translateX on :active so the global press-scale doesn't snap the button right", () => {
    // ROOT CAUSE of the "button moves 50% right on press" symptom:
    // base.css declares a global `button:active:not(:disabled) {
    // transform: scale(0.97); }`.  CSS `transform` is a single
    // property, so that rule CLOBBERS the centering
    // `transform: translateX(-50%)` on the show-more button.  Without
    // a scoped override, every press snaps the button's left edge
    // from `(50% − halfWidth)` to `50%` — the button visually jumps
    // half-its-width to the right, the cursor falls off the new
    // bounds, mouseup misses, and the click doesn't register.  The
    // fix concatenates both transforms in an `:active` override.  We
    // assert the textual presence of that override in the CSS source
    // so any future refactor that drops it fails this test.
    const css = stripCssComments(
      readSrc("styles/components/agent/AgentSessionView.css"),
    );
    const match = css.match(
      /\.agent-code-fence-show-more:active[^{]*\{([^}]*)\}/,
    );
    expect(
      match,
      "expected an :active override on .agent-code-fence-show-more",
    ).toBeTruthy();
    const body = match![1]!;
    expect(body).toMatch(/transform\s*:[^;]*translateX\s*\(\s*-50%/);
    expect(body).toMatch(/scale/);
  });
});
