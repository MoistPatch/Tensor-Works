import type { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { generateContent, SONNET } from "../lib/anthropic.js";
import { recordSpend } from "../lib/budget.js";

/** How many items to score in a single AI call */
const BATCH_SIZE = 20;

interface ScoreResult {
  id: string;
  relevanceScore: number;
  sentimentScore: number;
}

/**
 * Parse a JSON array of scoring results from the AI response.
 */
function parseScores(raw: string): ScoreResult[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    logger.warn("scoreNews: no JSON array found in AI response");
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown[];
    if (!Array.isArray(parsed)) return [];

    const results: ScoreResult[] = [];
    for (const item of parsed) {
      const obj = item as Record<string, unknown>;
      if (
        typeof obj.id === "string" &&
        typeof obj.relevanceScore === "number" &&
        typeof obj.sentimentScore === "number"
      ) {
        results.push({
          id: obj.id,
          relevanceScore: Math.max(0, Math.min(1, obj.relevanceScore)),
          sentimentScore: Math.max(-1, Math.min(1, obj.sentimentScore)),
        });
      }
    }
    return results;
  } catch (err) {
    logger.warn({ err }, "scoreNews: failed to parse AI response JSON");
    return [];
  }
}

async function scoreBatch(
  batch: Array<{ id: string; title: string; summary: string | null }>
): Promise<{ scores: ScoreResult[]; inputTokens: number; outputTokens: number; costAud: number }> {
  const itemList = batch
    .map(
      (item) =>
        `ID: ${item.id}\nTitle: ${item.title}\nSummary: ${item.summary ?? "(none)"}`
    )
    .join("\n\n---\n\n");

  const systemPrompt = `You are an AI infrastructure industry analyst for TensorWorks, an Australian AI infrastructure company.
Score news items for relevance to the AI compute and infrastructure industry, and for sentiment.`;

  const userPrompt = `Score each of the following news items on two dimensions:

1. relevanceScore (0.0–1.0): How relevant is this item to the AI compute and infrastructure industry?
   - 1.0 = directly about AI hardware, data centres, GPU/TPU supply chains, cloud AI services, AI model infrastructure
   - 0.5 = tangentially related (general cloud, semiconductor news)
   - 0.0 = unrelated

2. sentimentScore (-1.0 to 1.0): Overall sentiment of the item
   - 1.0 = very positive
   - 0.0 = neutral
   - -1.0 = very negative

Return ONLY a JSON array. No prose before or after.

JSON format:
[
  {
    "id": "item-id",
    "relevanceScore": 0.85,
    "sentimentScore": 0.2
  }
]

News items:
${itemList}`;

  const result = await generateContent({
    model: SONNET,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 2048,
  });

  const scores = parseScores(result.content);

  return {
    scores,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costAud: result.costAud,
  };
}

/**
 * BullMQ job processor: runs hourly at +15 minutes.
 *
 * 1. Load NewsItems without relevanceScore from last 24h.
 * 2. Batch score with Sonnet 4.6.
 * 3. Update DB records with relevanceScore and sentimentScore.
 * 4. Recalculate TriangulationGroup.avgRelevance for affected clusters.
 */
export async function processScoreNews(_job: Job): Promise<void> {
  logger.info("scoreNews: starting run");

  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000);

  const items = await prisma.newsItem.findMany({
    where: {
      relevanceScore: null,
      banned: false,
      fetchedAt: { gte: since },
    },
    select: { id: true, title: true, summary: true, clusterId: true },
  });

  if (items.length === 0) {
    logger.info("scoreNews: no unscored items found, skipping");
    return;
  }

  logger.info({ itemCount: items.length }, "scoreNews: scoring items");

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostAud = 0;
  let totalScored = 0;
  const affectedClusterIds = new Set<string>();

  // Process in batches
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    try {
      const { scores, inputTokens, outputTokens, costAud } = await scoreBatch(batch);

      await recordSpend(costAud);
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      totalCostAud += costAud;

      for (const score of scores) {
        await prisma.newsItem.update({
          where: { id: score.id },
          data: {
            relevanceScore: score.relevanceScore,
            sentimentScore: score.sentimentScore,
          },
        });

        const item = batch.find((b) => b.id === score.id);
        if (item?.clusterId) {
          affectedClusterIds.add(item.clusterId);
        }

        totalScored++;
      }
    } catch (err) {
      logger.error(
        { batchStart: i, batchSize: batch.length, err },
        "scoreNews: batch scoring failed"
      );
    }
  }

  // Update avgRelevance for affected clusters
  for (const clusterId of affectedClusterIds) {
    try {
      const clusterItems = await prisma.newsItem.findMany({
        where: {
          clusterId,
          relevanceScore: { not: null },
        },
        select: { relevanceScore: true },
      });

      if (clusterItems.length === 0) continue;

      const avg =
        clusterItems.reduce((sum, ci) => sum + (ci.relevanceScore ?? 0), 0) /
        clusterItems.length;

      await prisma.triangulationGroup.update({
        where: { id: clusterId },
        data: { avgRelevance: avg },
      });
    } catch (err) {
      logger.error({ clusterId, err }, "scoreNews: failed to update cluster avgRelevance");
    }
  }

  logger.info(
    {
      itemsScored: totalScored,
      clustersUpdated: affectedClusterIds.size,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      costAud: totalCostAud.toFixed(4),
    },
    "scoreNews: run complete"
  );
}

/** Named export expected by index.ts */
export const scoreNewsProcessor = processScoreNews;
