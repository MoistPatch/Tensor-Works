/**
 * generateCampaign
 *
 * Triggered when a BlogPost transitions to status='published'.
 * Parameters: { postId: string; tier: string }
 *
 * tier logic:
 *   "daily-scan"    → skip (no individual campaign)
 *   "weekly-digest" → call assembleWeeklyDigestEmail(postId)
 *   "deep-analysis" → generate post_announcement campaigns for newsletter_signup, rfq_submitter, customer
 */

import type { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { generateContent, SONNET } from "../lib/anthropic.js";
import { assembleWeeklyDigestEmail } from "./assembleWeeklyDigestEmail.js";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tensorworks.com.au";

const DEEP_ANALYSIS_SEGMENTS = [
  "newsletter_signup",
  "rfq_submitter",
  "customer",
] as const;

type DeepAnalysisSegment = (typeof DEEP_ANALYSIS_SEGMENTS)[number];

function segmentSystemPrompt(segment: DeepAnalysisSegment): string {
  switch (segment) {
    case "newsletter_signup":
      return `You are writing an announcement email for a new deep-analysis post published by TensorWorks, an Australian AI infrastructure company.
Audience: technical professionals and AI infrastructure enthusiasts who subscribed to industry updates.
Tone: peer-to-peer, direct, technical value-focused. No hype.
Australian English. Write 3 concise paragraphs (max 200 words total).
Do not use markdown. Output plain prose paragraphs separated by blank lines.`;

    case "rfq_submitter":
      return `You are writing an announcement email for a new deep-analysis post published by TensorWorks.
Audience: procurement professionals and decision-makers who have submitted an RFQ with TensorWorks.
Tone: relationship-oriented, consultative. Connect the analysis to their procurement or infrastructure needs.
Australian English. Write 3 concise paragraphs (max 200 words total).
Do not use markdown. Output plain prose paragraphs separated by blank lines.`;

    case "customer":
      return `You are writing an announcement email for a new deep-analysis post published by TensorWorks.
Audience: existing TensorWorks customers.
Tone: account management, succinct and relevant. Brief executive-style summary.
Australian English. Write 3 concise paragraphs (max 200 words total).
Do not use markdown. Output plain prose paragraphs separated by blank lines.`;
  }
}

function segmentSubject(segment: DeepAnalysisSegment, title: string): string {
  switch (segment) {
    case "newsletter_signup":
      return `[New analysis] ${title}`;
    case "rfq_submitter":
      return `New TensorWorks analysis relevant to your inquiry: ${title}`;
    case "customer":
      return `New analysis from TensorWorks: ${title}`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildAnnouncementHtml(params: {
  title: string;
  slug: string;
  bodyText: string;
  previewText: string;
}): string {
  const { title, slug, bodyText } = params;
  const postUrl = `${SITE_URL}/blog/${slug}`;

  const paragraphs = bodyText
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#374151;line-height:1.6;font-size:15px;">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="padding:24px 16px;">
        <table role="presentation" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:24px 32px;">
              <a href="${SITE_URL}" style="color:#ffffff;font-size:20px;font-weight:700;text-decoration:none;">TensorWorks</a>
              <span style="color:#9ca3af;font-size:13px;display:block;margin-top:4px;">AI Infrastructure Intelligence</span>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px 32px 16px;">
              <p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Deep Analysis</p>
              <h1 style="margin:0 0 20px;font-size:22px;color:#111827;line-height:1.3;">${escapeHtml(title)}</h1>
              ${paragraphs}
              <p style="margin:24px 0 0;">
                <a href="${postUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">Read the full analysis →</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                You are receiving this because you subscribed to TensorWorks AI infrastructure updates.<br>
                <a href="${SITE_URL}/unsubscribe" style="color:#9ca3af;">Unsubscribe</a> &bull;
                <a href="${SITE_URL}" style="color:#9ca3af;">Visit website</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildAnnouncementText(params: {
  title: string;
  slug: string;
  bodyText: string;
}): string {
  const { title, slug, bodyText } = params;
  const postUrl = `${SITE_URL}/blog/${slug}`;

  return [
    "TensorWorks — AI Infrastructure Intelligence",
    "=".repeat(50),
    "",
    `Deep Analysis: ${title}`,
    "",
    bodyText.trim(),
    "",
    "-".repeat(50),
    `Read the full analysis: ${postUrl}`,
    "",
    `Unsubscribe: ${SITE_URL}/unsubscribe`,
    `TensorWorks — ${SITE_URL}`,
  ].join("\n");
}

async function generateDeepAnalysisCampaigns(
  postId: string,
  title: string,
  summary: string,
  slug: string
): Promise<void> {
  logger.info({ postId, title }, "generateCampaign: generating deep-analysis announcement campaigns");

  let totalCostAud = 0;

  for (const segment of DEEP_ANALYSIS_SEGMENTS) {
    logger.info({ postId, segment }, "generateCampaign: generating announcement for segment");

    const result = await generateContent({
      model: SONNET,
      system: segmentSystemPrompt(segment),
      messages: [
        {
          role: "user",
          content: `Write a 3-paragraph announcement email for this new deep analysis post.

Title: ${title}
Summary: ${summary}

Requirements:
- 3 paragraphs, max 200 words total
- Segment: ${segment.replace(/_/g, " ")}
- Australian English
- No hype or marketing clichés
- Plain prose, no markdown`,
        },
      ],
      maxTokens: 512,
    });

    totalCostAud += result.costAud;

    const bodyText = result.content.trim();
    const subjectLine = segmentSubject(segment, title);
    const previewText = summary.slice(0, 150);

    const bodyHtml = buildAnnouncementHtml({
      title,
      slug,
      bodyText,
      previewText,
    });

    const bodyTextFormatted = buildAnnouncementText({ title, slug, bodyText });

    await prisma.emailCampaign.create({
      data: {
        type: "post_announcement",
        segmentTag: segment,
        blogPostId: postId,
        subjectLine,
        previewText,
        bodyHtml,
        bodyText: bodyTextFormatted,
        bodyMjml: "",
        status: "draft",
        generatedBy: "worker:generateCampaign",
      },
    });

    logger.info({ postId, segment }, "generateCampaign: announcement draft created");
  }

  logger.info(
    { postId, totalCostAud: totalCostAud.toFixed(4) },
    "generateCampaign: deep-analysis campaigns generated"
  );
}

export async function processGenerateCampaign(job: Job): Promise<void> {
  const { postId, tier } = job.data as { postId: string; tier: string };

  if (!postId || !tier) {
    throw new Error("generateCampaign: missing postId or tier in job data");
  }

  logger.info({ postId, tier }, "generateCampaign: starting");

  switch (tier) {
    case "daily-scan":
      logger.info({ postId }, "generateCampaign: daily-scan tier — skipping (no individual campaign)");
      return;

    case "weekly-digest": {
      // assembleWeeklyDigestEmail handles this tier
      await assembleWeeklyDigestEmail(postId);
      return;
    }

    case "deep-analysis": {
      // Fetch the post for title, summary, slug
      const post = await prisma.blogPost.findUnique({
        where: { id: postId },
        select: { id: true, title: true, summary: true, slug: true, tier: true },
      });

      if (!post) {
        throw new Error(`generateCampaign: BlogPost ${postId} not found`);
      }

      await generateDeepAnalysisCampaigns(
        postId,
        post.title,
        post.summary,
        post.slug
      );
      return;
    }

    default:
      logger.warn({ postId, tier }, "generateCampaign: unknown tier — skipping");
  }
}
