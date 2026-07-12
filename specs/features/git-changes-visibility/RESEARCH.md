# RESEARCH — git-changes-visibility

Mapa do estado atual (investigação pré-SPEC, 2026-07-09). Fonte para o specifier; não é SPEC.

## Problema relatado (usuário)
"Clico nos arquivos e não me mostram o que foi alterado." Superfícies afetadas (confirmado com usuário): painel Git (aba Changes), Explorer/árvore de arquivos, editor aberto.

Objetivos confirmados (multi-select do usuário):
1. Corrigir diff que não abre (bug)
2. Diff para untracked / alternar staged-unstaged
3. Diff mais rico (side-by-side, syntax highlight, word-level)
4. Gutter de mudanças no editor (estilo VS Code)

## Estado atual do código

### Fluxo clique → diff (painel Git)
- `src/components/GitProjectSection.tsx:223` — `handleFileClick` chama `onDiffFile`
- `src/components/GitProjectSection.tsx:224` — **`file.status !== "untracked"` bloqueia silenciosamente**: clique em untracked não faz nada (causa raiz #1 do "nada aparece")
- `src/components/GitPanel.tsx:75` — GitPanel global despacha `SET_DIFF_VIEWER` → side viewer
- `src/components/SessionGitPanel.tsx:67,128` — SessionGitPanel NÃO despacha `SET_DIFF_VIEWER`; usa `diffTarget` local + modal `variant="modal"` (comportamento divergente entre as duas surfaces)
- `src/App.tsx:966,988` — side viewer renderiza só se `ui.viewer != null` E sessão ativa; `GitDiffView variant="inline"` quando `ui.viewer.kind === "diff"`
- `src/state/SessionContext.tsx:938` — `case "SET_DIFF_VIEWER"` única ação que seta viewer diff

### Backend (Tauri / git2)
- `src-tauri/src/git/mod.rs:980` — `git_diff(state, session_id, project_id, file_path, staged: bool)`
- `:998` — staged=true → `diff_tree_to_index`; staged=false → `diff_index_to_workdir`
- `:1007` — **untracked: sem `INCLUDE_UNTRACKED` → diff vazio** (causa raiz #2)
- `:1021` — `MAX_DIFF_BYTES` cap; diff truncado vira `is_binary=true` (UX enganosa: mostra "Binary file")

### Renderização do diff
- `src/components/GitDiffView.tsx` — parse manual de `diff_text` linha a linha; classes CSS por prefixo (`+`/`-`/`@@`); sem syntax highlight, sem side-by-side, sem word-level diff

### Explorer
- `src/components/FileExplorerPanel.tsx:99,108,193,218` — badges de status git (cor + letra M/A/D/R/?) já existem
- `:522` — clique → `SET_FILE_PREVIEW` (preview de arquivo, não diff)
- `:501` — duplo-clique → abre em editor externo

### Editor
- `src/editor/EditorPane.tsx:3-14` — CodeMirror 6; `lineNumbers`, `highlightActiveLineGutter`, `foldGutter` presentes; **sem gutter de status git** (nenhum `GutterMarker` de diff)

### Tipos
- `src/types/git.ts:6` — `GitFile { path, status, area, old_path }`
- `:33` — `GitDiff { path, diff_text, is_binary, additions, deletions }`
- `:57` — `FileEntry.git_status: string | null` (alimenta badges da árvore)

## Causas raiz do bug relatado
1. Untracked bloqueado no frontend (GitProjectSection:224) — clique silenciosamente ignorado.
2. Backend não gera diff para untracked (mod.rs:1007).
3. SessionGitPanel usa modal local, GitPanel usa side viewer — comportamentos divergentes confundem.
4. Diff grande truncado exibido como "Binary file".

## Contexto de arquitetura (fallback — sem AGENTS.md)
Referências obrigatórias: `ARCHITECTURE.md`, `CLAUDE.md`, `DESIGN_PRINCIPLES.md`, `docs/adr/001-agent-mode.md`.
Regras relevantes do CLAUDE.md: TypeScript strict; CSS por componente em `src/styles/` (sem CSS-in-JS); componentes funcionais com hooks; estado em `SessionContext`; Rust `cargo fmt`/`clippy`.
