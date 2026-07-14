# SPEC: remove-usage-activity-tab

## RIGID

- RF-01: A activity bar direita NÃO deve exibir a tab "Usage · plan & limits" em nenhum modo de sessão (agent ou terminal).
- RF-02: A cláusula de render do `UsagePanel` no right rail (`src/App.tsx`) deve ser removida — sem a tab, `ui.usagePanelOpen` nunca vira `true`, tornando o mount inalcançável (dead code).
- RF-03: Os arquivos `src/components/UsagePanel.tsx`, `src/styles/components/UsagePanel.css` e `src/windows/UsageWindow.tsx` DEVEM ser preservados (decisão do usuário: manter código do componente).
- RF-04: O caminho `openUsageWindow()` a partir do `WorkbenchPanel` deve continuar funcionando (é janela separada, não o painel do right rail).
- RF-05: Estado `usagePanelOpen` / action `TOGGLE_USAGE` em `SessionContext`/`types/session.ts` podem permanecer (compatibilidade de estado persistido), mas nenhum dispatcher de UI da activity bar deve referenciá-los para a tab removida.
- RF-06: `npx tsc --noEmit` sem erros novos; suíte de testes verde; testes que assertem a presença da tab Usage na activity bar devem ser atualizados/removidos.

## Acceptance Criteria

- AC-1: Em sessão agent, activity bar direita mostra apenas Workbench (sem Usage).
- AC-2: Em sessão terminal, activity bar direita mostra apenas Context (sem Usage).
