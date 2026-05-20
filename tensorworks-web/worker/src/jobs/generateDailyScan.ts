import type { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { generateContent, SONNET } from "../lib/anthropic.js";
import { checkBudget, recordSpend } from "../lib/budget.js";
import { checkDailyScan } from "../lib/qualityGate.js";
import type { Post, Citation } from "../lib/qualityGate.js";
import { sendImmediateReviewNotification } from "./notifyReview.js";

const TIER = "daily-scan";

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

/** Extract citation URLs from HTML body (href attributes). */
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

/** Extract a plain-text title from the first <h1> or <h2> in the HTML body. */
function extractTitle(body: string): string {
  const match = body.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i);
  return match ? match[1].trim() : "Daily Scan";
}

async function generatePost(
  topic: string,
  clusterSummary: string,
  feedbackNote?: string
): Promise<GeneratedWithUsage> {
  const systemPrompt = `You are a technical writer for TensorWorks, an Australian AI infrastructure company.
Write factual, concise daily scan posts about AI compute and infrastructure industry developments.
Use Australian English throughout.
Avoid: revolutionary, cutting-edge, world-class, next-generation, breakthrough, AI-powered, synergies, leverage, unlock, supercharge, harness, delve, dive deep, and similar marketing clichés.
Format your response as HTML using only these tags: h2, p, ul, ol, li. Do not use markdown or h1 tags.`;

  const feedbackSection = feedbackNote
    ? `\n\nPrevious attempt feedback:\n${feedbackNote}\nPlease address these issues in this attempt.\n`
    : "";

  const userPrompt = `Write a daily scan post about the following AI infrastructure topic. The post must be 400–800 words.

Topic: ${topic}
Summary of recent developments: ${clusterSummary}
${feedbackSection}
Requirements:
- 400–800 words
- Australian English
- At least 2 citations as HTML links (e.g. <a href="https://...">source title</a>)
- At least one <h2> heading
- Factual and objective tone
- No banned phrases
- HTML format (h2, p, ul, ol, li tags only — no markdown)

Begin your response directly with the HTML content (starting with <h2> or <p>).`;

  const result = await generateContent({
    model: SONNET,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 2048,
  });

  await recordSpend(result.costAud);

  const body = result.content;
  const title = extractTitle(body);
  const citations = extractCitationsFromHtml(body);

  return {
    title,
    body,
    citations,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costAud: result.costAud,
  };
}

/**
 * BullMQ job processor: weekdays 0600 AEST.
 * Tier: daily-scan, model: Sonnet 4.6.
 */
export async function processGenerateDailyScan(_job: Job): Promise<void> {
  logger.info("generateDailyScan: starting run");

  await checkBudget(TIER);

  // Find the highest-scoring pending cluster from the last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000);

  const cluster = await prisma.triangulationGroup.findFirst({
    where: {
      status: "pending",
      avgRelevance: { not: null },
      createdAt: { gte: since },
    },
    orderBy: { avgRelevance: "desc" },
  });

  if (!cluster) {
    logger.info("generateDailyScan: no eligible cluster found, skipping");
    return;
  }

  logger.info(
    { clusterId: cluster.id, topic: cluster.topic, avgRelevance: cluster.avgRelevance },
    "generateDailyScan: selected cluster"
  );

  let inputTokensTotal = 0;
  let outputTokensTotal = 0;
  let costAudTotal = 0;
  let attempts = 0;

  // First attempt
  attempts++;
  let generated = await generatePost(cluster.topic, cluster.summary ?? cluster.topic);
  inputTokensTotal += generated.inputTokens ?? 0;
  outputTokensTotal += generated.outputTokens ?? 0;
  costAudTotal += generated.costAud ?? 0;

  const post1: Post = {
    title: generated.title,
    body: generated.body,
    citations: generated.citations,
    tags: [],
  };
  let quality = checkDailyScan(post1);

  if (!quality.passed) {
    logger.warn(
      { issues: quality.issues, score: quality.score },
      "generateDailyScan: quality gate failed on first attempt, retrying with feedback"
    );

    attempts++;
    const feedbackNote = `Issues to fix:\n${quality.issues.map((i) => `- ${i}`).join("\n")}`;
    generated = await generatePost(cluster.topic, cluster.summary ?? cluster.topic, feedbackNote);
    inputTokensTotal += generated.inputTokens ?? 0;
    outputTokensTotal += generated.outputTokens ?? 0;
    costAudTotal += generated.costAud ?? 0;

    const post2: Post = {
      title: generated.title,
      body: generated.body,
      citations: generated.citations,
      tags: [],
    };
    quality = checkDailyScan(post2);

    if (!quality.passed) {
      logger.error(
        { clusterId: cluster.id, issues: quality.issues },
        "generateDailyScan: quality gate failed after retry, marking cluster as dismissed"
      );

      await prisma.triangulationGroup.update({
        where: { id: cluster.id },
        data: { status: "dismissed" },
      });

      return;
    }
  }

  // Save the post
  const slug = `${slugify(generated.title)}-${Date.now()}`;
  const wordCount = countWords(generated.body);

  const savedPost = await prisma.blogPost.create({
    data: {
      slug,
      title: generated.title,
      subtitle: null,
      category: "ai-infrastructure",
      tier: TIER,
      status: "pending_review",
      body: generated.body,
      summary: cluster.summary ?? cluster.topic,
      citations: generated.citations.map((c) => ({
        url: c.url,
        title: c.url,
        accessed: new Date().toISOString().split("T")[0],
      })),
      tags: [],
      wordCount,
      generationCost: costAudTotal,
      modelUsed: SONNET,
      promptTokens: inputTokensTotal,
      completionTokens: outputTokensTotal,
    },
  });

  // Create generation log
  await prisma.generationLog.create({
    data: {
      postId: savedPost.id,
      jobName: "generateDailyScan",
      model: SONNET,
      promptTokens: inputTokensTotal,
      completionTokens: outputTokensTotal,
      costAud: costAudTotal,
      qualityScore: quality.score,
      qualityReport: { passed: quality.passed, issues: quality.issues, score: quality.score },
      researchUrls: generated.citations.map((c) => c.url),
      attempts,
    },
  });

  // Mark the cluster as used
  await prisma.triangulationGroup.update({
    where: { id: cluster.id },
    data: { status: "used", usedInPostId: savedPost.id },
  });

  logger.info(
    {
      postId: savedPost.id,
      slug,
      wordCount,
      costAud: costAudTotal.toFixed(4),
      qualityScore: quality.score,
      attempts,
    },
    "generateDailyScan: post saved, queuing review notification"
  );

  await sendImmediateReviewNotification({
    id: savedPost.id,
    title: savedPost.title,
    tier: TIER,
    wordCount,
  });
}

// ---------------------------------------------------------------------------
// Internal type helpers
// ---------------------------------------------------------------------------

interface GeneratedWithUsage {
  title: string;
  body: string;
  citations: Citation[];
  inputTokens?: number;
  outputTokens?: number;
  costAud?: number;
}

/** Named export expected by index.ts */
export const generateDailyScanProcessor = processGenerateDailyScan;
