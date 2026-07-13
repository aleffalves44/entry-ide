/**
 * modelPricing — the single cost function of the accounting (audit D2/D3).
 */
import { describe, it, expect } from "vitest";
import { costForUsage, ratesForModel } from "../utils/modelPricing";

const U = (input: number, output: number, read = 0, write = 0) => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_tokens: read,
  cache_creation_tokens: write,
});

describe("ratesForModel", () => {
  it("matches families across id variants", () => {
    expect(ratesForModel("claude-opus-4-8").inputPerM).toBe(5);
    expect(ratesForModel("claude-fable-5[1m]").inputPerM).toBe(10);
    expect(ratesForModel("anthropic.claude-sonnet-5").inputPerM).toBe(3);
    expect(ratesForModel("claude-haiku-4-5-20251001").outputPerM).toBe(5);
  });

  it("falls back to sonnet-tier rates for unknown ids (never $0)", () => {
    expect(ratesForModel("some-future-model").inputPerM).toBe(3);
    expect(ratesForModel(null).outputPerM).toBe(15);
  });
});

describe("costForUsage", () => {
  it("decomposes in/out/cache-write/cache-read with the canonical multipliers", () => {
    // sonnet: in $3, out $15, write 3.75, read 0.30 per MTok
    const cost = costForUsage("claude-sonnet-5", U(1_000_000, 1_000_000, 1_000_000, 1_000_000));
    expect(cost).toBeCloseTo(3 + 15 + 0.3 + 3.75, 6);
  });

  it("tokens > 0 never yields $0 for any family", () => {
    for (const model of ["claude-fable-5", "claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5", "mystery"]) {
      expect(costForUsage(model, U(100, 100))).toBeGreaterThan(0);
    }
  });
});
