# STATUS — git-changes-visibility

- pipeline: /plan
- input: texto livre (sem Jira) — "melhorar visualização das alterações do git; clico nos arquivos e não mostram o que foi alterado"
- input_hash: dcb14a926896
- artifacts_root: specs
- slug: git-changes-visibility
- overall_status: done
- agents_tree: ausente — fallback aceito (ARCHITECTURE.md, CLAUDE.md, DESIGN_PRINCIPLES.md, docs/adr/001-agent-mode.md)
- spike_context_path: (nenhum)
- sensei_state: ready (2.2.1)
- sensei_rules: present
- sensei_baseline: pré-existente (mantido, não sobrescrito)

## Steps

- [x] 1. Pre-fetch + normalização + clarificação de escopo com usuário
- [x] 2. AGENTS Tree Gate (fallback ADR/ARCHITECTURE.md, com aviso)
- [x] 2b. Investigação de código → RESEARCH.md
- [x] 3. specifier → SPEC.md (v1.0: 9 RF, 4 UI, 2 CT, 3 RNF, tier standard)
- [x] 3b. Checkpoint humano SPEC — aprovado; highlight = CodeMirror 6 language packs
- [x] 4. clarifier — marker RNF-02 resolvido, SPEC v1.1, zero markers
- [x] 5. sensei ready/present/baseline mantido + plan → PLAN.md (8 tasks, 4 fases)
- [x] 5b. Checkpoint humano PLAN — aprovado; Q1 = hook useGitLineMarkers no EditorPane; Q2 = SessionContext; Q3 = GitDiffView.css novo
- [x] 6. STATUS finalizado

## Escopo confirmado com usuário

Superfícies: painel Git (Changes), Explorer, editor.
Objetivos: (1) fix diff que não abre; (2) diff untracked + staged/unstaged; (3) diff rico (side-by-side, syntax highlight, word-level); (4) gutter de mudanças no editor.
Decisão: feature única com PLAN faseado.

## Tasks do PLAN.md

- [x] T01 — Rust: `truncated` em `GitDiff` + diff para untracked (CT-01, CT-02, RF-03, RF-09)
- [x] T02 — Desbloquear clique untracked em `GitProjectSection` (RF-01) — após T01
- [x] T03 — Unificar `SessionGitPanel` via `SET_DIFF_VIEWER` (RF-02) — paralelo a T01
- [x] T04 — Banner de diff truncado no viewer (RF-05, RF-09, UI-04)
- [x] T05 — Toggle staged/unstaged (RF-04, UI-01) — após T04
- [x] T06 — Side-by-side + syntax highlight (CM6 packs) + word-diff + `SET_DIFF_VIEW_MODE` (RF-06, RF-07, UI-02) — após T05
- [x] T07 — `gitGutter.ts` + `useGitLineMarkers` no `EditorPane` (RF-08, UI-03, RNF-01) — após T06
- [x] T08 — Suíte `git-diff-viewer.test.ts` (contratos IPC + comportamentos) — após T01–T07

Gates por fase: `cargo clippy -- -D warnings`, `npx tsc --noEmit`, `npm run test`, `sensei gate`; perf manual (viewer < 300ms/500 linhas; editor mount delta < 50ms).

## /task — inference (cache)

- agent: harness-cmd:Build
- mode: planned (SPEC v1.1 + PLAN via /plan)
- tier: standard
- pr_policy: open (respondido pelo dev, 2026-07-09)
- escopo: completo T01–T08 (respondido pelo dev)
- branch: feat/git-changes-visibility (base: main)
- task_steps:
  - [x] §1 inference
  - [x] §2 build
  - [x] §3 review (gates: tsc ✓, vitest 3630 ✓, cargo fmt/clippy/test ✓, vite build ✓)
  - [x] §4 PR
