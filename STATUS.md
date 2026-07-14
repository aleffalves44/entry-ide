# STATUS — /task Fase 2 (Navegação & UX de erro)

## Inference (cached)
- input: free text, 3 sub-tarefas (2a, 2b, 2c), cada uma 1 branch + pipeline
- agent: frontend-engineer
- mode: quick | tier: light
- pr_policy: skip (AskUserQuestion, cached — não re-perguntar)
- artifacts_root: specs
- base branch: main
- AGENTS tree: absent → fallback ADR (docs/adr/001, 002) + CLAUDE.md
- sensei_state: ready | sensei_rules: present (boundaries=none) | coderabbit_status: ready (0.6.5)

## Sub-tarefas
### 2a — session-mode-selector (branch feat/session-mode-selector)
- [x] §1 inference
- [ ] §2 write (frontend-engineer)
- [ ] §3 review (reviewer-engineer)
- [ ] §4 finalize (skip PR → pipeline_complete_without_pr)

### 2b — agent-error-actions (branch feat/agent-error-actions)
- [ ] §1–§4

### 2c — onboarding-two-screens (branch feat/onboarding-two-screens)
- [ ] §1–§4

overall_status: in_progress
