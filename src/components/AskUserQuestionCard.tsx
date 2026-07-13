/**
 * AskUserQuestion slide-up card.
 *
 * Visual: docs/internal/v1-tui-parity-plan.md §8.2.
 *
 * Renders Claude's structured question as a native UI: radio (single)
 * or checkbox (multi) with auto "Other" textarea for freeform answers.
 *
 * The card responds via the `canUseTool` permission channel — `onAllow`
 * receives an `updatedInput` shaped exactly the way the SDK's
 * AskUserQuestion tool expects (per the bundled binary's Zod schema).
 * `onDeny` cancels the tool call and Claude reads "user declined" as
 * the deny message.  Composer suppression while this card is mounted
 * is the parent's job (the dispatcher) — this card just renders +
 * reports its decision.
 */
import "../styles/components/AskUserQuestionCard.css";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildAskAnswersUpdatedInput,
  type AskAnswer,
  type AskUserQuestionInput,
  type AskUserQuestionOption,
} from "../utils/askUserQuestion";
import { fmt, isActionMod } from "../utils/platform";

const OTHER_LABEL = "Other";

interface Props {
  /** The original AskUserQuestion tool input — questions + options. */
  input: AskUserQuestionInput;
  /** Caller will turn this into a `_entry_perm_response` with
   *  decision `{ behavior: "allow", updatedInput }`.  The SDK then
   *  formats the user-facing tool_result message itself. */
  onAllow: (updatedInput: Record<string, unknown>) => void;
  /** Caller will turn this into `{ behavior: "deny", message }`. */
  onDeny: () => void;
  /** Optional id for aria-labeling / tests; not part of the protocol
   *  anymore.  Defaults to the perm-request id at the call site. */
  dialogId?: string;
}

interface PerQuestionState {
  selected: string[]; // labels
  otherText: string;
}

export function AskUserQuestionCard({ input, onAllow, onDeny, dialogId }: Props) {
  // Normalize defensively: the SDK delivers AskUserQuestion's input via
  // canUseTool as a complete, validated object, but a malformed/partial
  // envelope (or a future schema drift) can arrive with `questions`
  // missing or a question whose `options` is undefined/empty.  Without
  // this guard, `q.options.map` / `q.options.some` throw on `undefined`
  // and the card crashes mid-render — the symptom the user reported as
  // "the Claude question selector shows up empty."  Coerce every question
  // to a safe shape so the render path never throws, then surface the
  // degenerate case explicitly below instead of rendering a blank
  // selector (the project rule prohibits a silent default).
  const rawQuestions = Array.isArray(input?.questions) ? input.questions : [];
  const questions = rawQuestions.map((q) => ({
    ...q,
    options: Array.isArray(q?.options) ? q.options : [],
  }));
  const [state, setState] = useState<PerQuestionState[]>(() =>
    questions.map(() => ({ selected: [], otherText: "" })),
  );
  const onDenyRef = useRef(onDeny);
  onDenyRef.current = onDeny;

  // Mirror the latest submit handler and disabled flag behind a ref so
  // the global keydown listener doesn't need to re-bind on every state
  // change.  Set just below, where `handleSubmit` is declared.
  const submitActionRef = useRef<() => void>(() => {});

  // A question with no usable options (empty/missing) is unusable — the
  // "Other" freeform row alone is not a meaningful selector.  Detect this
  // once so both the auto-deny effect and the render path agree.
  const degenerate =
    questions.length === 0 || questions.some((q) => q.options.length === 0);

  // Degenerate input: nothing usable to render, auto-deny so the turn
  // doesn't hang.  Mirrors the prior empty-questions behaviour but now
  // also covers empty-options questions (the real "empty selector"
  // symptom).
  useEffect(() => {
    if (degenerate) onDenyRef.current();
  }, [degenerate]);

  // Global shortcuts.  Esc cancels; Cmd/Ctrl+Enter submits (when the
  // form is valid — the ref's wrapper short-circuits on disabled state
  // so we don't have to thread `submitDisabled` through here).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onDenyRef.current();
        return;
      }
      if (e.key === "Enter" && isActionMod(e)) {
        // Naked Enter belongs to the "Other" textarea (newlines).  Only
        // the action-mod combo submits — this is the cross-app
        // convention (Slack, GitHub, Linear).
        e.preventDefault();
        submitActionRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const focusedOptions = useMemo(
    () => questions.map((_q, i) => state[i]?.selected[0] ?? null).map((label, i) =>
      label ? questions[i].options.find((o) => o.label === label) ?? null : null,
    ),
    [questions, state],
  );

  const submitDisabled = useMemo(() => {
    return questions.some((_q, i) => {
      const s = state[i];
      if (!s) return true;
      if (s.selected.includes(OTHER_LABEL)) {
        return s.otherText.trim() === "";
      }
      return s.selected.length === 0;
    });
  }, [questions, state]);

  // Nothing to render at all (no questions).  The auto-deny effect above
  // already cancelled the turn; don't paint an empty card.
  if (questions.length === 0) return null;

  // A question exists but has no options.  The auto-deny effect has
  // already fired (the turn is being cancelled), but render an explicit
  // notice for the brief moment the card is on screen — NEVER a blank
  // selector (the project rule: no silent default).
  const emptyOptionQuestion = questions.find((q) => q.options.length === 0);
  if (emptyOptionQuestion) {
    return (
      <div
        className="aq-card aq-card-degenerate"
        data-dialog-id={dialogId}
        role="dialog"
        aria-label="Entry IDE received an empty question"
      >
        <div className="aq-card-bar" aria-hidden="true" />
        <div className="aq-card-body">
          <div className="aq-card-header">ENTRY IS WAITING FOR YOU</div>
          <div className="aq-degenerate-notice">
            Claude sent a question with no options to pick from.
            {typeof emptyOptionQuestion.question === "string"
              && emptyOptionQuestion.question.trim() !== "" && (
                <span className="aq-degenerate-question">
                  {emptyOptionQuestion.question}
                </span>
              )}
            <span className="aq-degenerate-hint">
              Cancelling the question so Claude can continue — no answer
              was silently chosen for you.
            </span>
          </div>
        </div>
      </div>
    );
  }

  function handleSelect(qIndex: number, label: string, multi: boolean) {
    setState((prev) => {
      const next = [...prev];
      const cur = next[qIndex];
      if (multi) {
        const has = cur.selected.includes(label);
        next[qIndex] = {
          ...cur,
          selected: has
            ? cur.selected.filter((l) => l !== label)
            : [...cur.selected, label],
        };
      } else {
        next[qIndex] = { ...cur, selected: [label] };
      }
      return next;
    });
  }

  function handleSubmit() {
    if (submitDisabled) return;
    const answers: AskAnswer[] = questions.map((q, i) => {
      const s = state[i];
      const ans: AskAnswer = { question: q.question, selected: s.selected };
      if (s.selected.includes(OTHER_LABEL) && s.otherText.trim() !== "") {
        ans.notes = s.otherText.trim();
      }
      return ans;
    });
    const updatedInput = buildAskAnswersUpdatedInput(input, answers);
    onAllow(updatedInput);
  }

  // Keep the keydown listener's view of "submit" in sync with the latest
  // closure (which captures the current `state`, `input`, `submitDisabled`).
  submitActionRef.current = handleSubmit;

  return (
    <div
      className="aq-card"
      data-dialog-id={dialogId}
      role="dialog"
      aria-label="Entry IDE is waiting for your answer"
    >
      <div className="aq-card-bar" aria-hidden="true" />
      <div className="aq-card-body">
        <div className="aq-card-header">ENTRY IS WAITING FOR YOU</div>
        {questions.map((q, qi) => (
          <fieldset key={qi} className="aq-question">
            <legend className="aq-question-legend">{q.header || `Q${qi + 1}`}</legend>
            <div className="aq-question-text">{q.question}</div>
            <div className="aq-question-body">
              <div className="aq-options">
                {q.options.map((opt) => (
                  <OptionRow
                    key={opt.label}
                    qIndex={qi}
                    option={opt}
                    multi={q.multiSelect}
                    selected={state[qi]?.selected.includes(opt.label) ?? false}
                    onSelect={() => handleSelect(qi, opt.label, q.multiSelect)}
                  />
                ))}
                <OtherRow
                  qIndex={qi}
                  multi={q.multiSelect}
                  selected={state[qi]?.selected.includes(OTHER_LABEL) ?? false}
                  text={state[qi]?.otherText ?? ""}
                  onSelect={() => handleSelect(qi, OTHER_LABEL, q.multiSelect)}
                  onTextChange={(value) =>
                    setState((prev) => {
                      const next = [...prev];
                      next[qi] = { ...next[qi], otherText: value };
                      return next;
                    })
                  }
                />
              </div>
              {q.options.some((o) => o.preview) && (
                <PreviewPane option={focusedOptions[qi]} />
              )}
            </div>
          </fieldset>
        ))}
        <div className="aq-actions">
          <button
            type="button"
            className="aq-cancel"
            onClick={() => onDeny()}
          >
            <span className="aq-cancel-kbd" aria-hidden="true">Esc</span>
            cancel
          </button>
          <button
            type="button"
            className="aq-send"
            onClick={handleSubmit}
            disabled={submitDisabled}
            title={`Submit answers (${fmt("{mod}")}Enter)`}
          >
            <span className="aq-send-kbd" aria-hidden="true">{fmt("{mod}")}⏎</span>
            send
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionRow({
  qIndex,
  option,
  multi,
  selected,
  onSelect,
}: {
  qIndex: number;
  option: AskUserQuestionOption;
  multi: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const id = `aq-q${qIndex}-${option.label}`;
  return (
    <label className="aq-option-row" data-selected={selected}>
      <input
        id={id}
        type={multi ? "checkbox" : "radio"}
        name={`aq-q${qIndex}`}
        checked={selected}
        onChange={onSelect}
        className="aq-option-input"
      />
      <span className="aq-option-glyph" aria-hidden="true">
        {selected ? (multi ? "☑" : "◉") : (multi ? "☐" : "○")}
      </span>
      <span className="aq-option-text">
        <span className="aq-option-label">{option.label}</span>
        {option.description && (
          <span className="aq-option-description">{option.description}</span>
        )}
      </span>
    </label>
  );
}

function OtherRow({
  qIndex,
  multi,
  selected,
  text,
  onSelect,
  onTextChange,
}: {
  qIndex: number;
  multi: boolean;
  selected: boolean;
  text: string;
  onSelect: () => void;
  onTextChange: (v: string) => void;
}) {
  return (
    <label className="aq-option-row aq-option-row-other" data-selected={selected}>
      <input
        type={multi ? "checkbox" : "radio"}
        name={`aq-q${qIndex}`}
        checked={selected}
        onChange={onSelect}
        className="aq-option-input"
      />
      <span className="aq-option-glyph" aria-hidden="true">
        {selected ? (multi ? "☑" : "◉") : (multi ? "☐" : "○")}
      </span>
      <span className="aq-option-text">
        <span className="aq-option-label">{OTHER_LABEL}</span>
        {selected && (
          <textarea
            className="aq-other-textarea"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="type a custom answer…"
            rows={2}
            autoFocus
          />
        )}
      </span>
    </label>
  );
}

function PreviewPane({ option }: { option: AskUserQuestionOption | null }) {
  return (
    <div className="aq-preview-pane" data-testid="aq-preview-pane">
      {option?.preview ? (
        <pre className="aq-preview-content">{option.preview}</pre>
      ) : (
        <span className="aq-preview-empty">focus an option to preview</span>
      )}
    </div>
  );
}
