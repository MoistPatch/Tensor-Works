import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger.js";
import { calculateCostAUD, SONNET } from "./anthropic.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface ResearchResult {
  summary: string;
  sources: ResearchSource[];
  inputTokens: number;
  outputTokens: number;
  costAud: number;
}

/**
 * Research a topic using Anthropic's web_search tool.
 * Constructs a prompt that asks factual questions about the topic,
 * then extracts cited URLs from the response.
 */
export async function researchTopic(
  topic: string,
  questions: string[]
): Promise<ResearchResult> {
  logger.info({ topic, questionCount: questions.length }, "Starting research phase");

  const questionsText = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");

  const prompt = `You are a research assistant helping TensorWorks, an Australian AI infrastructure company, gather factual information on a topic.

Topic: ${topic}

Please research and answer the following questions with factual, up-to-date information. Use web search to find recent sources. For each piece of information, cite the source.

Questions:
${questionsText}

After researching, provide a structured summary covering all the questions. Include specific facts, figures, and developments you find. Cite all sources used.`;

  const response = await client.messages.create({
    model: SONNET,
    max_tokens: 4096,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
      } as Parameters<typeof client.messages.create>[0]["tools"][number],
    ],
    messages: [{ role: "user", content: prompt }],
  });

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costAud = calculateCostAUD(SONNET, inputTokens, outputTokens);

  // Extract text content from response blocks
  const textContent = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("\n");

  // Extract sources from web_search_result blocks and from cited URLs in text
  const sources: ResearchSource[] = [];
  const seenUrls = new Set<string>();

  for (const block of response.content) {
    if (block.type === "tool_result") {
      // tool_result blocks may contain search results
      const resultBlock = block as {
        type: "tool_result";
        content?: Array<{ type: string; text?: string }> | string;
      };
      const content =
        typeof resultBlock.content === "string"
          ? resultBlock.content
          : Array.isArray(resultBlock.content)
            ? resultBlock.content
              .filter((c) => c.type === "text")
              .map((c) => c.text ?? "")
              .join("\n")
            : "";

      // Parse JSON search results if present
      try {
        const parsed = JSON.parse(content) as Array<{
          title?: string;
          url?: string;
          snippet?: string;
        }>;
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.url && !seenUrls.has(item.url)) {
              seenUrls.add(item.url);
              sources.push({
                title: item.title ?? item.url,
                url: item.url,
                snippet: item.snippet ?? "",
              });
            }
          }
        }
      } catch {
        // Not JSON, skip
      }
    }
  }

  // Also extract URLs from text content via regex as fallback
  const urlPattern = /https?:\/\/[^\s\)\]\>'"]+/g;
  const textUrls = textContent.match(urlPattern) ?? [];
  for (const url of textUrls) {
    const cleanUrl = url.replace(/[.,;:!?]+$/, "");
    if (!seenUrls.has(cleanUrl)) {
      seenUrls.add(cleanUrl);
      // Try to extract a surrounding title from text
      sources.push({
        title: cleanUrl,
        url: cleanUrl,
        snippet: "",
      });
    }
  }

  logger.info(
    { topic, sourceCount: sources.length, inputTokens, outputTokens, costAud: costAud.toFixed(4) },
    "Research phase complete"
  );

  return {
    summary: textContent,
    sources,
    inputTokens,
    outputTokens,
    costAud,
  };
}
