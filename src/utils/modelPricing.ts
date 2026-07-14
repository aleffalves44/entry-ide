/**
 * modelPricing — per-model API rates used to compute per-turn cost from
 * usage fields (the same cost function for main and subagent turns —
 * audit fix D2/D3).
 *
 * Rates in USD per million tokens, from the official model catalog
 * (cached 2026-06; source: platform.claude.com/docs/en/pricing).
 * Cache multipliers are canonical: write = 1.25× input (5-minute TTL),
 * read = 0.1× input.  If the harness uses 1-hour TTL writes (2×), this
 * slightly underestimates cache-write cost — acceptable for local
 * accounting; adjust here if it starts to matter.
 *
 * Matching is by family substring so versioned/suffixed ids
 * ("claude-fable-5[1m]", "claude-opus-4-8", "anthropic.claude-…")
 * resolve without an exhaustive list.
 */

export interface ModelRates {
  /** USD per 1M input tokens. */
  inputPerM: number;
  /** USD per 1M output tokens. */
  outputPerM: number;
  /** USD per 1M cache-creation tokens (1.25× input, 5m TTL). */
  cacheWritePerM: number;
  /** USD per 1M cache-read tokens (0.1× input). */
  cacheReadPerM: number;
}

function rates(inputPerM: number, outputPerM: number): ModelRates {
  return {
    inputPerM,
    outputPerM,
    cacheWritePerM: inputPerM * 1.25,
    cacheReadPerM: inputPerM * 0.1,
  };
}

const FAMILIES: [RegExp, ModelRates][] = [
  [/fable|mythos/i, rates(10, 50)],
  [/opus/i, rates(5, 25)],
  [/sonnet/i, rates(3, 15)],
  [/haiku/i, rates(1, 5)],
];

/** Sonnet-tier fallback for unrecognized ids — fabricating $0 for real
 *  consumption is worse than an approximate rate (audit criterion: no
 *  row with tokens > 0 and cost $0). */
const FALLBACK = rates(3, 15);

export function ratesForModel(model: string | null | undefined): ModelRates {
  if (model) {
    for (const [pattern, r] of FAMILIES) {
      if (pattern.test(model)) return r;
    }
  }
  return FALLBACK;
}

export interface UsageTokens {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
}

/** Cost of one turn's usage on one model — the single cost function
 *  applied to every accounting row. */
export function costForUsage(model: string | null | undefined, u: UsageTokens): number {
  const r = ratesForModel(model);
  return (
    (u.input_tokens * r.inputPerM +
      u.output_tokens * r.outputPerM +
      u.cache_creation_tokens * r.cacheWritePerM +
      u.cache_read_tokens * r.cacheReadPerM) /
    1_000_000
  );
}
