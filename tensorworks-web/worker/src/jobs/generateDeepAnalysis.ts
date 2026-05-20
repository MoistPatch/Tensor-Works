import type { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { generateContent, OPUS } from "../lib/anthropic.js";
import { checkBudget, recordSpend } from "../lib/budget.js";
import { checkDeepAnalysis } from "../lib/qualityGate.js";
import type { Post, Citation } from "../lib/qualityGate.js";
import { researchTopic } from "../lib/research.js";
import { sendImmediateReviewNotification } from "./notifyReview.js";

const TIER = "deep-analysis";
const THINKING_BUDGET = 10_000;

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
  return match ? match[1].trim() : "Deep Analysis";
}

/**
 * Returns the ISO Monday date for the current week (UTC).
 */
function currentWeekMonday(): Date {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysBack);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/**
 * Alternate Tuesday gate: returns true only on odd ISO week numbers
 * so deep analysis runs every other week.
 */
function isDeepAnalysisWeek(): boolean {
  const now = new Date();
  // ISO week number
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
  const isoWeek = Math.ceil((dayOfYear + startOfYear.getUTCDay() + 1) / 7);
  return isoWeek % 2 === 1;
}

/**
 * BullMQ job processor: alternate Tuesdays 0800 AEST.
 * Tier: deep-analysis, model: Opus 4.7 with extended thinking.
 */
export async function processGenerateDeepAnalysis(_job: Job): Promise<void> {
  logger.info("generateDeepAnalysis: starting run");

  // Check week parity — only run on alternate Tuesdays
  if (!isDeepAnalysisWeek()) {
    logger.info("generateDeepAnalysis: not a deep-analysis week (even ISO week), skipping");
    return;
  }

  await checkBudget(TIER);

  // Find the assigned editorial calendar entry for this week
  const thisWeekMonday = currentWeekMonday();

  const entry = await prisma.editorialCalendar.findFirst({
    where: {
      status: "assigned",
      targetWeek: thisWeekMonday,
    },
  });

  if (!entry) {
    logger.info(
      { thisWeekMonday: thisWeekMonday.toISOString() },
      "generateDeepAnalysis: no assigned editorial entry for this week, skipping"
    );
    return;
  }

  logger.info(
    { entryId: entry.id, topic: entry.topic },
    "generateDeepAnalysis: selected topic for deep analysis"
  );

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostAud = 0;

  // Research phase
  logger.info({ topic: entry.topic }, "generateDeepAnalysis: starting research phase");
  const research = await researchTopic(entry.topic, [
    `What is the current state of ${entry.topic}?`,
    `What are the key technical challenges and innovations in ${entry.topic}?`,
    `Who are the major players and what positions are they taking on ${entry.topic}?`,
    `What are the economic and market dynamics around ${entry.topic}?`,
    `What does the near-term future look like for ${entry.topic}?`,
    `What are the implications for Australian AI infrastructure from ${entry.topic}?`,
  ]);

  totalInputTokens += research.inputTokens;
  totalOutputTokens += research.outputTokens;
  totalCostAud += research.costAud;
  await recordSpend(research.costAud);

  logger.info(
    { sourceCount: research.sources.length },
    "generateDeepAnalysis: research complete"
  );

  const researchUrlList = research.sources
    .map((s) => `- ${s.title}: ${s.url}`)
    .join("\n");

  const systemPrompt = `You are a principal engineer at TensorWorks, an Australian AI infrastructure company.
Write comprehensive, deeply technical analysis posts on AI infrastructure topics.
Your audience is technically sophisticated: infrastructure architects, procurement leads, and CTO-level readers.
Use Australian English throughout.
Avoid: revolutionary, cutting-edge, world-class, next-generation, breakthrough, AI-powered, synergies, leverage, unlock, supercharge, harness, delve, dive deep, and similar marketing clichés.
Format your response as HTML using only these tags: h2, h3, p, ul, ol, li, a, blockquote. Do not use markdown.`;

  const userPrompt = `Write a comprehensive deep analysis on the following AI infrastructure topic. The post must be 2500–6000 words.

Topic: ${entry.topic}
Description: ${entry.description}

Research findings:
${research.summary}

Available research sources (use at least 8):
${researchUrlList || "(none available — use general knowledge)"}

Requirements:
- 2500–6000 words
- Australian English
- At least 8 citations as HTML links (e.g. <a href="https://...">source title</a>)
- At least 5 <h2> headings organising the analysis
- Deep technical analysis, not surface-level overview
- Address implications for AI infrastructure specifically
- Discuss market dynamics, technical constraints, and future directions
- No banned phrases
- HTML format (h2, h3, p, ul, ol, li, a, blockquote tags only — no markdown)

Begin your response directly with the HTML content.`;

  const genResult = await generateContent({
    model: OPUS,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 12_000,
    thinkingBudget: THINKING_BUDGET,
  });

  totalInputTokens += genResult.inputTokens;
  totalOutputTokens += genResult.outputTokens;
  totalCostAud += genResult.costAud;
  await recordSpend(genResult.costAud);

  const body = genResult.content;
  const title = extractTitle(body);
  const citations = extractCitationsFromHtml(body);
  const sourceTexts = research.sources.map((s) => s.snippet);

  const post: Post = { title, body, citations, tags: [] };
  const quality = checkDeepAnalysis(post, sourceTexts.length > 0 ? sourceTexts : null);

  if (!quality.passed) {
    logger.warn(
      { issues: quality.issues, score: quality.score },
      "generateDeepAnalysis: quality gate failed — saving with warning"
    );
  }

  const slug = `${slugify(title)}-${Date.now()}`;
  const wordCount = countWords(body);

  const savedPost = await prisma.blogPost.create({
    data: {
      slug,
      title,
      subtitle: entry.description.slice(0, 200),
      category: entry.category,
      tier: TIER,
      status: "pending_review",
      body,
      summary: entry.description,
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
      jobName: "generateDeepAnalysis",
      model: OPUS,
      promptTokens: totalInputTokens,
      completionTokens: totalOutputTokens,
      costAud: totalCostAud,
      qualityScore: quality.score,
      qualityReport: { passed: quality.passed, issues: quality.issues, score: quality.score },
      researchUrls: research.sources.map((s) => s.url),
      attempts: 1,
    },
  });

  // Link the editorial entry to the generated post
  await prisma.editorialCalendar.update({
    where: { id: entry.id },
    data: {
      status: "generated",
      postId: savedPost.id,
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
    "generateDeepAnalysis: post saved, queuing review notification"
  );

  await sendImmediateReviewNotification({
    id: savedPost.id,
    title: savedPost.title,
    tier: TIER,
    wordCount,
  });
}

/** Named export expected by index.ts */
export const generateDeepAnalysisProcessor = processGenerateDeepAnalysis;
