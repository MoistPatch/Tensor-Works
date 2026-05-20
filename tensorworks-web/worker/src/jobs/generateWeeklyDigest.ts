import type { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { generateContent, OPUS } from "../lib/anthropic.js";
import { checkBudget, recordSpend } from "../lib/budget.js";
import { checkWeeklyDigest } from "../lib/qualityGate.js";
import type { Post, Citation } from "../lib/qualityGate.js";
import { researchTopic } from "../lib/research.js";
import { sendImmediateReviewNotification } from "./notifyReview.js";

const TIER = "weekly-digest";
const TOP_CLUSTER_LIMIT = 5;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

function extractCitationsFromHtml(body: string): Citation[] {
  const hrefPattern = /href="(https?:\/\/[^"]+)"/g;
  const citations: Citation[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = hrefPattern.exec(body)) !== null) {
    const url = match[1];
    if (!seen.has(url)) {
      seen.add(url);
      citations.push({ url });
    }
  }

  return citations;
}

function extractTitle(body: string): string {
  const match = body.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i);
  return match ? match[1].trim() : "Weekly Digest";
}

/**
 * BullMQ job processor: Tuesdays 0700 AEST.
 * Tier: weekly-digest, model: Opus 4.7.
 */
export async function processGenerateWeeklyDigest(_job: Job): Promise<void> {
  logger.info("generateWeeklyDigest: starting run");

  await checkBudget(TIER);

  // Gather top 5 clusters from past 7 days by relevance
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);

  const clusters = await prisma.triangulationGroup.findMany({
    where: {
      status: { in: ["pending", "reviewed"] },
      avgRelevance: { not: null },
      createdAt: { gte: since },
    },
    orderBy: { avgRelevance: "desc" },
    take: TOP_CLUSTER_LIMIT,
  });

  if (clusters.length === 0) {
    logger.info("generateWeeklyDigest: no eligible clusters found, skipping");
    return;
  }

  logger.info(
    { clusterCount: clusters.length },
    "generateWeeklyDigest: selected clusters for digest"
  );

  // Research phase for each cluster topic
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostAud = 0;
  const allResearchSources: Array<{ title: string; url: string }> = [];
  const clusterResearch: Array<{ topic: string; summary: string; researchSummary: string }> = [];

  for (const cluster of clusters) {
    logger.info({ clusterId: cluster.id, topic: cluster.topic }, "generateWeeklyDigest: researching cluster");

    try {
      const research = await researchTopic(cluster.topic, [
        `What are the latest developments in ${cluster.topic}?`,
        `Who are the key players involved in ${cluster.topic}?`,
        `What are the implications for AI infrastructure from ${cluster.topic}?`,
      ]);

      totalInputTokens += research.inputTokens;
      totalOutputTokens += research.outputTokens;
      totalCostAud += research.costAud;

      for (const source of research.sources) {
        allResearchSources.push({ title: source.title, url: source.url });
      }

      clusterResearch.push({
        topic: cluster.topic,
        summary: cluster.summary ?? cluster.topic,
        researchSummary: research.summary,
      });
    } catch (err) {
      logger.warn(
        { clusterId: cluster.id, topic: cluster.topic, err },
        "generateWeeklyDigest: research failed for cluster, using summary only"
      );
      clusterResearch.push({
        topic: cluster.topic,
        summary: cluster.summary ?? cluster.topic,
        researchSummary: "",
      });
    }
  }

  await recordSpend(totalCostAud);

  // Build the digest sections for the prompt
  const digestSections = clusterResearch
    .map(
      (cr, i) => `## Topic ${i + 1}: ${cr.topic}
Cluster Summary: ${cr.summary}
${cr.researchSummary ? `Research Findings:\n${cr.researchSummary}` : ""}`
    )
    .join("\n\n---\n\n");

  const researchUrlList = allResearchSources
    .map((s) => `- ${s.title}: ${s.url}`)
    .join("\n");

  const systemPrompt = `You are a senior technical analyst at TensorWorks, an Australian AI infrastructure company.
Write in-depth, authoritative weekly digest posts covering AI infrastructure industry developments.
Use Australian English throughout.
Avoid: revolutionary, cutting-edge, world-class, next-generation, breakthrough, AI-powered, synergies, leverage, unlock, supercharge, harness, delve, dive deep, and similar marketing clichés.
Format your response as HTML using only these tags: h2, p, ul, ol, li, a. Do not use markdown.`;

  const userPrompt = `Write a weekly digest covering the following AI infrastructure topics from the past 7 days. The digest must be 1200–2500 words.

${digestSections}

Available research sources:
${researchUrlList || "(none available)"}

Requirements:
- 1200–2500 words
- Australian English
- At least 5 citations as HTML links (e.g. <a href="https://...">source title</a>)
- At least 3 <h2> headings (one per major topic section)
- Analytical, authoritative tone
- No banned phrases
- HTML format (h2, p, ul, ol, li, a tags only — no markdown)

Begin your response directly with the HTML content.`;

  const genResult = await generateContent({
    model: OPUS,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 6144,
  });

  totalInputTokens += genResult.inputTokens;
  totalOutputTokens += genResult.outputTokens;
  totalCostAud += genResult.costAud;
  await recordSpend(genResult.costAud);

  const body = genResult.content;
  const title = extractTitle(body);
  const citations = extractCitationsFromHtml(body);

  const post: Post = { title, body, citations, tags: [] };
  const quality = checkWeeklyDigest(post);

  if (!quality.passed) {
    logger.warn(
      { issues: quality.issues, score: quality.score },
      "generateWeeklyDigest: quality gate failed — saving with quality warning"
    );
  }

  const slug = `${slugify(title)}-${Date.now()}`;
  const wordCount = countWords(body);

  const topicList = clusters.map((c) => c.topic);

  const savedPost = await prisma.blogPost.create({
    data: {
      slug,
      title,
      subtitle: `Weekly AI Infrastructure Digest — ${new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
      category: "ai-infrastructure",
      tier: TIER,
      status: quality.passed ? "pending_review" : "pending_review",
      body,
      summary: `Weekly digest covering: ${topicList.join(", ")}`,
      citations: citations.map((c) => ({
        url: c.url,
        title: c.url,
        accessed: new Date().toISOString().split("T")[0],
      })),
      tags: [],
      wordCount,
      generationCost: totalCostAud,
      modelUsed: OPUS,
      promptTokens: totalInputTokens,
      completionTokens: totalOutputTokens,
    },
  });

  await prisma.generationLog.create({
    data: {
      postId: savedPost.id,
      jobName: "generateWeeklyDigest",
      model: OPUS,
      promptTokens: totalInputTokens,
      completionTokens: totalOutputTokens,
      costAud: totalCostAud,
      qualityScore: quality.score,
      qualityReport: { passed: quality.passed, issues: quality.issues, score: quality.score },
      researchUrls: allResearchSources.map((s) => s.url),
      attempts: 1,
    },
  });

  logger.info(
    {
      postId: savedPost.id,
      slug,
      wordCount,
      costAud: totalCostAud.toFixed(4),
      qualityScore: quality.score,
      citationCount: citations.length,
    },
    "generateWeeklyDigest: post saved, queuing review notification"
  );

  await sendImmediateReviewNotification({
    id: savedPost.id,
    title: savedPost.title,
    tier: TIER,
    wordCount,
  });
}

/** Named export expected by index.ts */
export const generateWeeklyDigestProcessor = processGenerateWeeklyDigest;
