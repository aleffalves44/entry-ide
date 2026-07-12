import { gutter, GutterMarker, type EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { BlockInfo } from "@codemirror/view";

/** Git line markers for the editor gutter.  Line numbers are 1-based,
 *  matching CodeMirror's `Line.number`. */
export interface GitGutterMarkers {
  added: Set<number>;
  modified: Set<number>;
  deleted: Set<number>;
}

class GitLineMarker extends GutterMarker {
  constructor(private readonly className: string) {
    super();
  }

  toDOM(): Node {
    const el = document.createElement("div");
    el.className = this.className;
    return el;
  }
}

const ADD_MARKER = new GitLineMarker("cm-git-gutter-add");
const MOD_MARKER = new GitLineMarker("cm-git-gutter-mod");
const DEL_MARKER = new GitLineMarker("cm-git-gutter-del");

/**
 * CodeMirror 6 gutter extension that shows git change markers next to
 * line numbers.  Accepts `null` to disable the gutter without removing
 * the extension slot from the configuration array — callers can keep a
 * stable `Compartment` and reconfigure with `[]` when no repo data is
 * available.
 */
export function gitGutterExtension(markers: GitGutterMarkers | null): Extension[] {
  if (!markers) return [];
  return [
    gutter({
      class: "cm-git-gutter",
      lineMarker(view: EditorView, line: BlockInfo) {
        const n = view.state.doc.lineAt(line.from).number;
        if (markers.added.has(n)) return ADD_MARKER;
        if (markers.modified.has(n)) return MOD_MARKER;
        if (markers.deleted.has(n)) return DEL_MARKER;
        return null;
      },
    }),
  ];
}
