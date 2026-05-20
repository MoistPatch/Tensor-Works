import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.js";
import { logger } from "./logger.js";

export const SONNET = "claude-sonnet-4-6";
export const OPUS = "claude-opus-4-7";

// Pricing per million tokens, in AUD (1 USD = 1.55 AUD)
const PRICING_AUD: Record<string, { input: number; output: number }> = {
  [SONNET]: { input: 6.20, output: 31.00 },
  [OPUS]: { input: 31.00, output: 155.00 },
};

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface GenerateContentOptions {
  model: string;
  system: string;
  messages: MessageParam[];
  maxTokens?: number;
  /** If set, enables extended thinking with the given token budget */
  thinkingBudget?: number;
}

export interface GenerateContentResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  costAud: number;
}

export function calculateCostAUD(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING_AUD[model];
  if (!pricing) {
    logger.warn({ model }, "Unknown model for cost calculation, using Sonnet pricing");
    const fallback = PRICING_AUD[SONNET]!;
    return (inputTokens / 1_000_000) * fallback.input +
      (outputTokens / 1_000_000) * fallback.output;
  }
  return (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output;
}

export async function generateContent(
  options: GenerateContentOptions
): Promise<GenerateContentResult> {
  const { model, system, messages, maxTokens = 4096, thinkingBudget } = options;

  logger.info({ model, thinkingBudget }, "Calling Anthropic API");

  // Build request params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any = {
    model,
    max_tokens: thinkingBudget ? maxTokens + thinkingBudget : maxTokens,
    system,
    messages,
  };

  if (thinkingBudget) {
    params.thinking = {
      type: "enabled",
      budget_tokens: thinkingBudget,
    };
  }

  const response = await client.messages.create(params);

  // Extract text content (skip thinking blocks)
  const textContent = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("\n");

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costAud = calculateCostAUD(model, inputTokens, outputTokens);

  logger.info(
    { model, inputTokens, outputTokens, costAud: costAud.toFixed(4) },
    "Anthropic API call complete"
  );

  return { content: textContent, inputTokens, outputTokens, costAud };
}
