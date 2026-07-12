/**
 * Factory presets for the loop runner (M6).  Each preset's prompt
 * instructs the agent to emit the stop marker when the goal is reached —
 * the loop engine watches for it and ends the loop as success.
 */
import type { LoopConfig } from "../state/loopStore";

export const LOOP_STOP_MARKER = "LOOP_DONE";

export const LOOP_DEFAULTS: Omit<LoopConfig, "prompt"> = {
  maxIterations: 10,
  costCeilingUsd: 2,
  delayMs: 5_000,
  stopMarker: LOOP_STOP_MARKER,
};

export interface LoopPreset {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

export const LOOP_PRESETS: LoopPreset[] = [
  {
    id: "tests-green",
    label: "Testes até verde",
    description: "Roda a suíte, corrige falhas e repete até tudo passar.",
    prompt:
      "Rode a suíte de testes do projeto. Se houver falhas, corrija a causa raiz e rode de novo dentro deste mesmo turno até onde conseguir. " +
      `Se TODOS os testes passarem, responda apenas ${LOOP_STOP_MARKER}. Se ainda houver falhas ao final do turno, resuma o que falta.`,
  },
  {
    id: "babysit-pr",
    label: "Babysit de PR",
    description: "Verifica comentários de review pendentes e resolve.",
    prompt:
      "Verifique com `gh` se o PR da branch atual tem comentários de review não resolvidos ou checks falhando. " +
      "Se houver, corrija os pontos e responda nos threads. " +
      `Se não houver nada pendente (sem comentários abertos e checks verdes), responda apenas ${LOOP_STOP_MARKER}.`,
  },
  {
    id: "custom",
    label: "Prompt customizado",
    description: "Você escreve o prompt; o loop repete até o marcador.",
    prompt: "",
  },
];
