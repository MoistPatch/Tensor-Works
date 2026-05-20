import type { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { generateContent, SONNET } from "../lib/anthropic.js";
import { recordSpend } from "../lib/budget.js";

const MIN_ITEMS_TO_CLUSTER = 5;

interface ClusterDef {
  topic: string;
  summary: string;
  itemIds: string[];
}

/**
 * Parse a JSON array of cluster definitions from the AI response.
 * Returns an empty array on failure to allow graceful degradation.
 */
function parseClusters(raw: string): ClusterDef[] {
  // Try to extract a JSON array from the response
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    logger.warn("clusterNews: no JSON array found in AI response");
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown[];
    if (!Array.isArray(parsed)) return [];

    const clusters: ClusterDef[] = [];
    for (const item of parsed) {
      const obj = item as Record<string, unknown>;
      if (
        typeof obj.topic === "string" &&
        typeof obj.summary === "string" &&
        Array.isArray(obj.itemIds)
      ) {
        clusters.push({
          topic: obj.topic,
          summary: obj.summary,
          itemIds: (obj.itemIds as unknown[])
            .filter((id): id is string => typeof id === "string"),
        });
      }
    }
    return clusters;
  } catch (err) {
    logger.warn({ err }, "clusterNews: failed to parse AI response JSON");
    return [];
  }
}

/**
 * BullMQ job processor: runs hourly.
 *
 * 1. Load unclustered NewsItems from last 24h (clusterId IS NULL, not banned).
 * 2. If fewer than MIN_ITEMS_TO_CLUSTER, skip.
 * 3. Build prompt for Sonnet 4.6: group items into topic clusters.
 * 4. Parse AI response to extract clusters.
 * 5. Create TriangulationGroup records.
 * 6. Update NewsItem.clusterId for grouped items.
 * 7. Record token spend.
 */
export async function processClusterNews(_job: Job): Promise<void> {
  logger.info("clusterNews: starting run");

  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000);

  const items = await prisma.newsItem.findMany({
    where: {
      clusterId: null,
      banned: false,
      fetchedAt: { gte: since },
    },
    select: { id: true, title: true, summary: true, url: true },
  });

  if (items.length < MIN_ITEMS_TO_CLUSTER) {
    logger.info(
      { itemCount: items.length, minimum: MIN_ITEMS_TO_CLUSTER },
      "clusterNews: not enough items to cluster, skipping"
    );
    return;
  }

  logger.info({ itemCount: items.length }, "clusterNews: clustering items");

  const itemList = items
    .map(
      (item) =>
        `ID: ${item.id}\nTitle: ${item.title}\nSummary: ${item.summary ?? "(none)"}`
    )
    .join("\n\n---\n\n");

  const systemPrompt = `You are an AI infrastructure industry news analyst for TensorWorks, an Australian AI infrastructure company.
Your task is to group a list of news items into thematic clusters related to AI compute and infrastructure.`;

  const userPrompt = `Group the following news items into topic clusters. Each cluster should represent a distinct theme or story.

Rules:
- Only group items that are clearly related. It is acceptable to leave some items ungrouped.
- Aim for clusters of 2–8 items.
- Provide a concise topic label (max 10 words) and a 1–2 sentence summary for each cluster.
- Return ONLY a JSON array. No prose before or after.

JSON format:
[
  {
    "topic": "short topic label",
    "summary": "one to two sentence summary of the cluster theme",
    "itemIds": ["id1", "id2", ...]
  }
]

News items:
${itemList}`;

  const result = await generateContent({
    model: SONNET,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 4096,
  });

  await recordSpend(result.costAud);

  const clusters = parseClusters(result.content);

  if (clusters.length === 0) {
    logger.warn("clusterNews: AI returned no parseable clusters");
    return;
  }

  logger.info({ clusterCount: clusters.length }, "clusterNews: creating TriangulationGroups");

  let groupsCreated = 0;
  let itemsAssigned = 0;

  for (const cluster of clusters) {
    // Verify all itemIds exist in the fetched set
    const validItemIds = cluster.itemIds.filter((id) =>
      items.some((item) => item.id === id)
    );

    if (validItemIds.length < 2) continue;

    const group = await prisma.triangulationGroup.create({
      data: {
        topic: cluster.topic,
        summary: cluster.summary,
        itemCount: validItemIds.length,
        status: "pending",
      },
    });

    await prisma.newsItem.updateMany({
      where: { id: { in: validItemIds } },
      data: { clusterId: group.id },
    });

    groupsCreated++;
    itemsAssigned += validItemIds.length;
  }

  logger.info(
    {
      groupsCreated,
      itemsAssigned,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costAud: result.costAud.toFixed(4),
    },
    "clusterNews: run complete"
  );
}

/** Named export expected by index.ts */
export const clusterNewsProcessor = processClusterNews;
