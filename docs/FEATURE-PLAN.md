# Entry IDE — Plano de Features

> **ESCOPO ATIVO (decidido em 2026-07-09):** somente Fase 2 (framework + observabilidade), com Claude como único provider. Fase 1 (Ollama), 2.7 (provider por fase) e 2.12 (backtest multi-backend) congeladas — retomam depois que o framework estiver instrumentado e provado.

**Objetivo:** o plugin `agentic-harness` como **framework de primeira classe dentro da IDE** — usável com qualquer provider (Claude, Ollama, qualquer endpoint Anthropic-compatible) e com observabilidade completa: consumo de tokens por comando, por agente, por modelo e por sessão. Métricas locais viram base para backtest e melhoria contínua do framework, provando o ganho com dados. Distribuição interna na Creditas quando maduro.

**Estado atual:** fork do Hermes IDE 1.3.2, rebrand user-facing completo, telemetria e updater removidos.

## Princípio arquitetural — um harness, vários cérebros

O workflow SDD (spike → plan → task → pr) é definido pelo plugin `harness-cmd` como skills/agents em markdown, executados pelo **Claude Code (harness)** — não pelo modelo. A troca de provider (Fase 1) muda só o endpoint do LLM (`ANTHROPIC_BASE_URL`), mantendo o harness intacto. Consequências:

1. **O plugin roda idêntico em qualquer provider** — workflow definido uma vez, usado com Claude, Ollama ou qualquer endpoint Anthropic-compatible.
2. **Entry IDE nunca implementa workflow** — só dá UI ao que o plugin define. Painel Pipeline lê as skills do plugin; se o plugin mudar, a UI acompanha sem release do app.
3. **Provider é atributo da sessão/fase**, não do workflow.
4. **Observabilidade é do harness, não do provider** — usage/modelUsage vêm dos eventos do SDK, uniformes para qualquer backend. Uma única camada de métricas cobre Claude e Ollama sem código por provider.

Pontos sensíveis a provider: `model:` no frontmatter de agents do plugin (nomes Anthropic não existem no Ollama — precisa mapear), qualidade de tool-calling (fase `/task` exige modelo forte) e janela de contexto (SDD carrega SPEC+PLAN+código).

---

## Fase 1 — Backend Ollama no Agent Mode (via compatibilidade Anthropic)

Ollama v0.14+ expõe endpoint `/v1/messages` compatível com a Messages API da Anthropic, com streaming e tool calling. O Claude Code (e portanto o `@anthropic-ai/claude-agent-sdk` usado pelo bridge) funciona contra Ollama apenas com:

```
ANTHROPIC_BASE_URL=http://localhost:11434
ANTHROPIC_AUTH_TOKEN=ollama
ANTHROPIC_MODEL=<modelo local, ex. qwen3-coder>
```

Nenhum bridge novo, nenhum executor de tools — todo o agent mode existente (thinking blocks, tool cards, permission modal, diffs) funciona inalterado; só o LLM por trás muda.

| # | Item | Descrição | Esforço |
|---|------|-----------|---------|
| 1.1 | Backend por sessão | SessionCreator ganha escolha de backend "Claude (Anthropic)" vs "Ollama (local)"; spawn do bridge (`src-tauri/src/agent/mod.rs`) injeta as env vars quando backend=ollama; persistir escolha na sessão (SQLite) | M |
| 1.2 | Model picker Ollama | Quando backend=ollama, ModelPicker popula via `GET http://localhost:11434/api/tags`; refresh manual | P |
| 1.3 | Detecção/saúde | Detectar Ollama instalado e rodando (padrão do `checkAiProviders` existente); erro claro se daemon parado ou modelo ausente | P |
| 1.4 | Cost dashboard | Sessões Ollama marcadas como local: custo R$0, mostrar tokens/latência | P |
| 1.5 | Guardas de qualidade | Aviso quando modelo tem contexto < 32k (recomendação mínima para Claude Code); nota de que tool calling depende do modelo (qwen3-coder ok, modelos menores degradam) | P |

**Risco principal:** qualidade de tool-calling varia por modelo local — problema do modelo, não da integração. Mitigação: lista de modelos recomendados no onboarding.

**Valor Creditas:** agent mode completo com modelos locais — custo zero de API e nenhum dado saindo da máquina.

---

## Fase 2 — Framework agentic-harness na IDE

**Base técnica (verificado no código):** o bridge (`hermes-claude-bridge.mjs`) constrói as `sdkOptions` **sem** `settingSources` — e o default do agent-sdk quando omitido é carregar todas as fontes (`user`, `project`, `local`), igual ao CLI. Ou seja: plugins do Claude Code do usuário (incluindo `harness-cmd`) já entram nas sessões agent hoje. O dropdown de slash commands é populado pelo `init.slash_commands` que o SDK emite no início da sessão (`src/agent/useAgentInit.ts`) + scan estático no prewarm (`read_static_slash_commands`).

### Bloco A — UI do pipeline

| # | Item | Descrição | Esforço | Critério de aceite |
|---|------|-----------|---------|--------------------|
| 2.1 | ✅ Smoke test de carga | **FEITO (2026-07-09, headless):** `init.slash_commands` lista `harness-cmd:spike/:plan/:task/:pr/:ai-context` prefixados `plugin:skill` — framework carrega nas sessões agent sem mudança alguma. Formato de disparo confirmado para o painel | P (horas) | ✅ Skills aparecem prefixadas |
| 2.2 | Painel Pipeline SDD | Nova aba no rail direito com as 4 fases. **Estado derivado de artefatos, não de estado paralelo**: spike feito = doc de spike existe; plan feito = SPEC.md/PLAN.md no worktree; task = commits na branch; pr = PR aberto (via `gh`/git). Disparo de fase = `sendAgentInput` com o slash command correspondente | M | Fase dispara com 1 clique; estado reflete filesystem/git |
| 2.3 | Render de artefatos | SPEC.md/PLAN.md clicáveis no painel → abrem no FilePreviewPanel (markdown já renderiza); highlight das seções RIGID/FLEXIBLE | P | Link abre artefato |
| 2.4 | Fallback sem plugin | Se harness-cmd não instalado, painel mostra instrução de instalação (link para doc interna) em vez de quebrar | P | Estado vazio orienta setup |
| 2.5 | Prompt bundle Creditas | Bundle `.hermes-prompts` com roles/estilos/templates do time; import já existe no PromptComposer | P | Bundle importa limpo |
| 2.6 | Empacotar como plugin Entry | Painel Pipeline vira plugin do SDK interno (`packages/plugin-sdk`): painéis, comandos e storage já suportados pela PluginAPI. Dogfooding — expõe lacunas do SDK antes de terceiros usarem | M | Painel instala/desinstala via PluginManager |
| 2.7 | Provider por fase | Painel Pipeline permite escolher backend/modelo por fase: ex. `/plan` no Claude (raciocínio pesado), `/task` no qwen3-coder local (volume de código, custo zero). Cada fase pode abrir sessão com env próprio — resolve os 3 pontos sensíveis a provider de uma vez. Requer mapeamento de `model:` de agents (frontmatter Anthropic → modelo local equivalente ou default da sessão) | M | Fase roda no backend escolhido; agents com model override não quebram no Ollama |

**Decisão de design:** estado das fases derivado de filesystem/git (determinístico, sobrevive a restart, zero migração de schema) em vez de tracking próprio em SQLite.

**Risco:** formato dos nomes no `init.slash_commands` para skills de plugin (prefixado vs não) — o smoke test 2.1 resolve a dúvida antes de investir no painel.

### Bloco B — Observabilidade do framework

**Estado atual da infra (verificado):** tabela `token_usage` guarda sessão/provider/modelo/tokens/custo — **sem** dimensão de comando, agente ou turno. O SDK emite `usage`/`modelUsage` por result (incluindo breakdown de subagents); o frontend já rastreia qual slash command iniciou cada turno (`slashReceiptSelector`) e os subagents da sessão (`subagentSelectors`). As peças existem; falta correlacionar e persistir.

| # | Item | Descrição | Esforço | Aceite |
|---|------|-----------|---------|--------|
| 2.8 | Schema de métricas | Nova tabela `framework_usage`: turno, sessão, provider, modelo, comando (slash que iniciou o turno, ex. `harness-cmd:task`), agente (subagent ou main), fase SDD, input/output/cache tokens, duração, custo, timestamp | P | Toda dimensão consultável via SQL |
| 2.9 | Instrumentação | No fim de cada turno: capturar `usage`+`modelUsage` do result, associar ao slash receipt e aos subagents do turno, persistir via comando Tauri. Zero mudança no plugin — instrumentação é do harness | M | Turno de `/task` com 3 subagents gera linhas por agente |
| 2.10 | Dashboard do framework | Evolução do CostDashboard: consumo por comando (`/plan` vs `/task`), por agente (Specifier, Build, Reviewer...), por modelo/provider, por sessão; custo, tokens e duração; filtro por período | M | Responde "quanto custa um /task médio?" sem sair da IDE |
| 2.11 | Export para backtest | Export JSONL/CSV das métricas cruas + metadados da sessão (repo, branch, resultado) para análise externa | P | Arquivo abre no pandas/sheets |
| 2.12 | Comparador de runs (backtest) | Mesma task executada em N backends/modelos (usa 2.7) → lado a lado: tokens, custo, duração, diff produzido. Base para responder "qwen3-coder dá conta do /task?" com dados | G | Comparação de 2 runs exibida lado a lado |

**Métricas de ganho do framework (definir no 2.8):** proxies mensuráveis — re-execuções por fase (retrabalho), tokens por PR aberto, duração por fase, taxa de PR aprovado sem revisão manual pesada. "Ganho" absoluto exige baseline sem framework; começar com tendência ao longo do tempo.

**Privacidade:** métricas 100% locais (SQLite), coerente com a remoção de telemetria. Agregação por time (enviar para algum lugar central) é decisão separada, com governança própria — fora deste plano.

**Valor Creditas:** esteira /discover → /plan → /task da AI Factory com UI e com números — custo por comando, modelo certo por fase, prova de ganho para expandir o uso.

---

## Fase 3 — Fundação de distribuição

Pré-requisitos para colocar na mão de outros usuários. O `release.yml` herdado já resolve o difícil (matriz multi-plataforma, assinatura Apple, assinatura de updater, bundling do helper PTY) — o trabalho é re-apontar nomes, URLs e secrets.

### Bloqueadores externos (correm em paralelo, owner: você)

| # | Item | Descrição |
|---|------|-----------|
| 3.1 | Validação jurídica | BSL 1.1: uso interno Creditas não é "oferecer a terceiros", mas precisa de parecer antes de distribuir |
| 3.2 | Canal de distribuição | App desktop não se encaixa nos canais padrão de ferramentas internas — alinhar com Engenharia da BU / #tech-devops |
| 3.3 | Apple Developer ID | Sem certificado + notarização, Gatekeeper bloqueia o app em qualquer máquina de terceiro. Conta Apple Developer (US$99/ano) — decidir se pessoal ou Creditas |

### Trabalho técnico (desbloqueado desde já)

| # | Item | Descrição | Esforço |
|---|------|-----------|---------|
| 3.4 | Keypair de updater | `npx tauri signer generate` → chave privada vira secrets `TAURI_SIGNING_PRIVATE_KEY`/`_PASSWORD` no repo; pubkey vai no `tauri.conf.json` | P (horas) |
| 3.5 | Reativar updater | `tauri.conf.json`: `plugins.updater` com pubkey nova + endpoint `github.com/aleffalves44/entry-ide/releases/latest/download/latest.json`; `createUpdaterArtifacts: true`; re-registrar `tauri_plugin_updater` no `lib.rs` (removido no rebrand) | P |
| 3.6 | Adaptar release.yml | Nomes de artefato `hermes-ide-*` → `entry-ide-*` (linhas 434-517), URLs `hermes-ide.com/changelog` no corpo do release e no `latest.json` (linhas 553, 646). O path do `.app` usa `find` (agnóstico a nome — sobrevive ao rename do productName). Refs a `hermes-pty-setup` ficam (helper não renomeado) | M |
| 3.7 | Secrets Apple no repo | `APPLE_CERTIFICATE_BASE64`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` (+ credenciais de notarização) — depende de 3.3 | P |
| 3.8 | Release de teste | Tag beta → workflow completo → instalar em máquina limpa → validar updater atualizando 1.3.2→1.3.3 | P |
| 3.9 | Onboarding Creditas | Presets no primeiro launch: MCP servers padrão, templates do time, setup do `claude` CLI apontando para o guia interno do Claude Pro | P |

**Sequência técnica:** 3.4 → 3.5 → 3.6 → 3.8 (sem assinatura Apple dá para validar em máquina própria com Gatekeeper liberado); 3.7 entra quando 3.3 resolver.

---

## Fase 4 — Workflows e produtividade (contínuo)

| # | Item | Descrição | Esforço |
|---|------|-----------|---------|
| 4.1 | Orquestração multi-sessão | Rodar N sessões agent em worktrees paralelos com fila e visão agregada (infra de worktree já existe) | G |
| 4.2 | Hooks pós-execução | Ação ao terminar tarefa: notificação nativa já existe; adicionar webhook/Slack | P |
| 4.3 | Refactor SessionContext | `src/state/SessionContext.tsx` (2.7k linhas) é gargalo de manutenção — dividir antes das fases 1-2 crescerem em cima | M |
| 4.4 | Rebrand interno (fase 2) | Renomear `HermesEvent`/`HermesPluginAPI`/env vars/`.hermes-prompts` — só se for expor SDK de plugins a terceiros | M |

---

## Ordem sugerida

```
2.1 (smoke test, horas)
→ 2.8/2.9 (métricas: schema + instrumentação — começa a acumular dados desde já)
→ 1.x (Ollama, ~1-2 semanas)
→ 4.3 (refactor SessionContext)
→ 2.2-2.7 (painel Pipeline + provider por fase)
→ 2.10-2.12 (dashboard, export, backtest)
→ 3.x (distribuição)
```

Racional: 2.1 valida a premissa em horas. **Métricas (2.8/2.9) sobem cedo de propósito** — todo dia sem instrumentação é dado de backtest perdido; o dashboard pode vir depois, os dados não. Ollama na frente do refactor porque encolheu (sem bridge novo). 4.3 antes do painel porque ele cresce em cima do estado de sessão. Backtest (2.12) por último no bloco — depende de provider por fase (2.7) e de dados acumulados. Bloqueadores externos da Fase 3 (jurídico, canal, Apple) correm em paralelo desde já.

**Efforts:** P = dias, M = ~1-2 semanas, G = 3+ semanas.
