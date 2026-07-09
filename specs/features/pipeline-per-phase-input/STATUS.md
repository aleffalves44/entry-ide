# STATUS — pipeline-per-phase-input

pipeline: plan
overall_status: in_progress
input: free-text (no Jira key)
input_summary: Replace shared task input above pipeline phases with per-phase click-to-expand description input + send button (PipelinePanel).
artifacts_root: specs
agents_tree: absent — fallback: CLAUDE.md, docs/FEATURE-PLAN.md, docs/adr/001-agent-mode.md

## Steps
- [x] 1 Pre-fetch + normalize input
- [x] 2 AGENTS Tree Gate (fallback accepted, warning emitted)
- [ ] 3 specifier → SPEC.md
- [ ] 4 clarifier (conditional)
- [ ] 5 plan → PLAN.md (+ sensei baseline)
- [ ] 6 finalize

## Tasks do PLAN.md
(pending)
