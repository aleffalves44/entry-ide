# STATUS — pipeline-phase-inline-input

pipeline: /plan
overall_status: done
input: free text (no Jira key) — replace PipelinePanel shared top input with per-phase inline description input + send button
artifacts_root: specs
agents_tree: absent (fallback: CLAUDE.md + docs/adr/001-agent-mode.md)

## /task inference (cached)
agent: frontend-engineer
mode: planned
tier: standard
pr_policy: draft
branch: feat/pipeline-phase-inline-input (base: main)

## /task steps
- [ ] 1 inference
- [ ] 2 write
- [ ] 3 review
- [ ] 4 PR (draft)

## Steps
- [x] 1 pre-fetch + normalize
- [x] 2 AGENTS Tree Gate (fallback accepted)
- [x] 3 specifier → SPEC.md (v1.0 rejeitada pelo dev; reescrita v2.0, 0 markers)
- [x] 4 clarifier → n/a na v2.0 (0 markers)
- [x] 5 plan → PLAN.md reescrito p/ v2.0 (sensei: ready, rules initialized, baseline saved, quality 4125)
- [x] 6 finalize

## Tasks do PLAN.md
- [ ] T01 — `PHASE_DESCRIPTIONS` em `pipelinePhases.ts` + testes RF-06 (fase 1)
- [ ] T02 — Reescrever `PipelinePanel.tsx`: remove `taskInput`/▶, adiciona `activePhase` + `PhaseExpandedSection` (fase 2, dep T01)
- [ ] T03 — CSS: remove `.pipeline-task-input`/`.pipeline-phase-run`, adiciona seção expandida (fase 2, dep T02)
- [ ] T04 — `pipeline-panel-expand.test.tsx` RF-01..05, UI-01..03 (fase 3, dep T01+T02)
