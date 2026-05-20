/**
 * assembleWeeklyDigestEmail
 *
 * Called after a weekly_digest BlogPost is set to status='approved'.
 * Generates per-segment EmailCampaign draft records using Claude-rendered HTML.
 *
 * Parameters: postId string
 */

import type { Job } from "bullmq";
import { Resend } from "resend";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { generateContent, SONNET } from "../lib/anthropic.js";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM_EMAIL = process.env.FROM_EMAIL ?? "noreply@tensorworks.com.au";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tensorworks.com.au";

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Segment configuration ────────────────────────────────────────────────────

const SEGMENTS = [
  "newsletter_signup",
  "rfq_submitter",
  "customer",
] as const;

type Segment = (typeof SEGMENTS)[number];

function segmentLabel(segment: Segment): string {
  switch (segment) {
    case "newsletter_signup":
      return "Newsletter Subscribers";
    case "rfq_submitter":
      return "RFQ Submitters";
    case "customer":
      return "Customers";
  }
}

function segmentSystemPrompt(segment: Segment): string {
  switch (segment) {
    case "newsletter_signup":
      return `You are writing a weekly AI infrastructure newsletter intro for technical professionals who signed up for industry updates.
Tone: peer-to-peer, technical, collegial. Voice: "this week in AI hardware..." style.
Australian English. Concise — 2-3 short paragraphs, no more than 120 words.
Do not use markdown. Output plain prose only.`;

    case "rfq_submitter":
      return `You are writing a weekly newsletter intro for people who have submitted procurement inquiries to TensorWorks.
Tone: relationship-oriented, professional. Voice: "in line with your recent inquiry..." style — acknowledge their interest and connect the content to their needs.
Australian English. Concise — 2-3 short paragraphs, no more than 120 words.
Do not use markdown. Output plain prose only.`;

    case "customer":
      return `You are writing a weekly newsletter intro for existing TensorWorks customers.
Tone: account management, warm and professional. Voice: brief executive summary — what matters this week and why it's relevant.
Australian English. Concise — 2-3 short paragraphs, no more than 120 words.
Do not use markdown. Output plain prose only.`;
  }
}

// ─── HTML rendering ───────────────────────────────────────────────────────────

interface NewsletterData {
  intro: string;
  weeklyDigest: {
    title: string;
    summary: string;
    slug: string;
    category: string;
  };
  dailyScans: Array<{
    title: string;
    summary: string;
    slug: string;
    publishedAt: Date | null;
  }>;
  deepAnalysis?: {
    title: string;
    summary: string;
    slug: string;
  } | null;
  segment: Segment;
  siteUrl: string;
}

export function renderNewsletterHtml(data: NewsletterData): string {
  const { intro, weeklyDigest, dailyScans, deepAnalysis, siteUrl } = data;

  const digestUrl = `${siteUrl}/blog/${weeklyDigest.slug}`;

  const dailyScanRows = dailyScans
    .slice(0, 5)
    .map(
      (post) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
          <a href="${siteUrl}/blog/${post.slug}" style="color:#2563eb;text-decoration:none;font-weight:600;">${escapeHtml(post.title)}</a>
          ${post.publishedAt ? `<br><span style="color:#9ca3af;font-size:12px;">${new Date(post.publishedAt).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}</span>` : ""}
          ${post.summary ? `<br><span style="color:#4b5563;font-size:13px;">${escapeHtml(post.summary.slice(0, 120))}…</span>` : ""}
        </td>
      </tr>`
    )
    .join("");

  const deepAnalysisSection = deepAnalysis
    ? `
    <tr>
      <td style="padding:24px 0 8px;">
        <h3 style="margin:0 0 8px;font-size:16px;color:#111827;">Deep Analysis</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
              <a href="${siteUrl}/blog/${deepAnalysis.slug}" style="color:#2563eb;text-decoration:none;font-weight:600;">${escapeHtml(deepAnalysis.title)}</a>
              ${deepAnalysis.summary ? `<br><span style="color:#4b5563;font-size:13px;">${escapeHtml(deepAnalysis.summary.slice(0, 160))}…</span>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(weeklyDigest.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="padding:24px 16px;">
        <table role="presentation" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:24px 32px;">
              <a href="${siteUrl}" style="color:#ffffff;font-size:20px;font-weight:700;text-decoration:none;">TensorWorks</a>
              <span style="color:#9ca3af;font-size:13px;display:block;margin-top:4px;">AI Infrastructure Intelligence</span>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:32px 32px 16px;">
              <p style="margin:0;color:#374151;line-height:1.6;font-size:15px;">${escapeHtml(intro).replace(/\n\n/g, '</p><p style="margin:12px 0;color:#374151;line-height:1.6;font-size:15px;">').replace(/\n/g, "<br>")}</p>
            </td>
          </tr>

          <!-- Weekly Digest Feature -->
          <tr>
            <td style="padding:16px 32px 8px;">
              <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">This Week's Digest</h2>
              <table style="width:100%;border-collapse:collapse;background:#f3f4f6;border-radius:6px;">
                <tr>
                  <td style="padding:16px;">
                    <a href="${digestUrl}" style="color:#2563eb;text-decoration:none;font-size:16px;font-weight:700;">${escapeHtml(weeklyDigest.title)}</a>
                    ${weeklyDigest.summary ? `<p style="margin:8px 0 0;color:#4b5563;font-size:13px;line-height:1.5;">${escapeHtml(weeklyDigest.summary.slice(0, 200))}…</p>` : ""}
                    <p style="margin:12px 0 0;">
                      <a href="${digestUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:8px 16px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:600;">Read full digest →</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Daily Scans -->
          ${dailyScans.length > 0 ? `
          <tr>
            <td style="padding:24px 32px 8px;">
              <h3 style="margin:0 0 8px;font-size:16px;color:#111827;">From This Week's Daily Scans</h3>
              <table style="width:100%;border-collapse:collapse;">
                ${dailyScanRows}
              </table>
            </td>
          </tr>` : ""}

          <!-- Deep Analysis -->
          ${deepAnalysisSection ? `
          <tr>
            <td style="padding:0 32px 8px;">
              ${deepAnalysisSection}
            </td>
          </tr>` : ""}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                You are receiving this because you subscribed to TensorWorks AI infrastructure updates.<br>
                <a href="${siteUrl}/unsubscribe" style="color:#9ca3af;">Unsubscribe</a> &bull;
                <a href="${siteUrl}" style="color:#9ca3af;">Visit website</a>
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

export function renderNewsletterText(data: NewsletterData): string {
  const { intro, weeklyDigest, dailyScans, deepAnalysis, siteUrl } = data;

  const lines: string[] = [];

  lines.push("TensorWorks — AI Infrastructure Intelligence");
  lines.push("=".repeat(50));
  lines.push("");
  lines.push(intro);
  lines.push("");
  lines.push("-".repeat(50));
  lines.push("THIS WEEK'S DIGEST");
  lines.push("-".repeat(50));
  lines.push(weeklyDigest.title);
  if (weeklyDigest.summary) {
    lines.push("");
    lines.push(weeklyDigest.summary.slice(0, 200) + "…");
  }
  lines.push("");
  lines.push(`Read: ${siteUrl}/blog/${weeklyDigest.slug}`);

  if (dailyScans.length > 0) {
    lines.push("");
    lines.push("-".repeat(50));
    lines.push("FROM THIS WEEK'S DAILY SCANS");
    lines.push("-".repeat(50));
    for (const post of dailyScans.slice(0, 5)) {
      lines.push("");
      lines.push(`• ${post.title}`);
      if (post.summary) lines.push(`  ${post.summary.slice(0, 120)}…`);
      lines.push(`  ${siteUrl}/blog/${post.slug}`);
    }
  }

  if (deepAnalysis) {
    lines.push("");
    lines.push("-".repeat(50));
    lines.push("DEEP ANALYSIS");
    lines.push("-".repeat(50));
    lines.push(deepAnalysis.title);
    if (deepAnalysis.summary) lines.push(deepAnalysis.summary.slice(0, 160) + "…");
    lines.push(`${siteUrl}/blog/${deepAnalysis.slug}`);
  }

  lines.push("");
  lines.push("-".repeat(50));
  lines.push(`Unsubscribe: ${siteUrl}/unsubscribe`);
  lines.push(`TensorWorks — ${siteUrl}`);

  return lines.join("\n");
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function assembleWeeklyDigestEmail(postId: string): Promise<void> {
  logger.info({ postId }, "assembleWeeklyDigestEmail: starting");

  // 1. Fetch the approved BlogPost
  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      summary: true,
      slug: true,
      category: true,
      status: true,
      tier: true,
    },
  });

  if (!post) {
    throw new Error(`assembleWeeklyDigestEmail: BlogPost ${postId} not found`);
  }

  if (post.tier !== "weekly-digest") {
    logger.warn(
      { postId, tier: post.tier },
      "assembleWeeklyDigestEmail: post is not weekly-digest tier, skipping"
    );
    return;
  }

  // 2. Fetch daily scan posts from last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);
  const dailyScans = await prisma.blogPost.findMany({
    where: {
      status: "published",
      tier: "daily-scan",
      publishedAt: { gte: sevenDaysAgo },
    },
    select: {
      id: true,
      title: true,
      summary: true,
      slug: true,
      publishedAt: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 5,
  });

  // 3. Fetch most recent deep_analysis post if publishedAt > 14 days ago
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1_000);
  const deepAnalysis = await prisma.blogPost.findFirst({
    where: {
      status: "published",
      tier: "deep-analysis",
      publishedAt: { gte: fourteenDaysAgo },
    },
    select: {
      id: true,
      title: true,
      summary: true,
      slug: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  logger.info(
    {
      postId,
      dailyScanCount: dailyScans.length,
      hasDeepAnalysis: !!deepAnalysis,
    },
    "assembleWeeklyDigestEmail: fetched content"
  );

  // 4. For each segment: generate intro + render HTML + create EmailCampaign record
  let totalCostAud = 0;
  const createdCampaigns: Array<{ id: string; segmentTag: string }> = [];

  for (const segment of SEGMENTS) {
    logger.info({ postId, segment }, "assembleWeeklyDigestEmail: generating intro for segment");

    // Generate segment-tailored intro using Claude Sonnet 4.6
    const introResult = await generateContent({
      model: SONNET,
      system: segmentSystemPrompt(segment),
      messages: [
        {
          role: "user",
          content: `Write the newsletter intro for this week's edition.

Weekly digest title: ${post.title}
Weekly digest summary: ${post.summary}
${dailyScans.length > 0 ? `\nRecent daily scan topics: ${dailyScans.map((s) => s.title).join(", ")}` : ""}
${deepAnalysis ? `\nDeep analysis available: ${deepAnalysis.title}` : ""}

Segment: ${segmentLabel(segment)}

Write the intro paragraph(s) now — plain prose, Australian English, 2-3 paragraphs, max 120 words.`,
        },
      ],
      maxTokens: 400,
    });

    totalCostAud += introResult.costAud;
    const intro = introResult.content.trim();

    // Render HTML and text
    const newsletterData: NewsletterData = {
      intro,
      weeklyDigest: {
        title: post.title,
        summary: post.summary,
        slug: post.slug,
        category: post.category,
      },
      dailyScans: dailyScans.map((ds) => ({
        title: ds.title,
        summary: ds.summary,
        slug: ds.slug,
        publishedAt: ds.publishedAt,
      })),
      deepAnalysis: deepAnalysis
        ? {
            title: deepAnalysis.title,
            summary: deepAnalysis.summary,
            slug: deepAnalysis.slug,
          }
        : null,
      segment,
      siteUrl: SITE_URL,
    };

    const bodyHtml = renderNewsletterHtml(newsletterData);
    const bodyText = renderNewsletterText(newsletterData);

    const subjectLine = `[TensorWorks Weekly] ${post.title}`;
    const previewText = post.summary.slice(0, 150);

    // Create EmailCampaign record
    const campaign = await prisma.emailCampaign.create({
      data: {
        type: "weekly_digest_email",
        segmentTag: segment,
        blogPostId: postId,
        subjectLine,
        previewText,
        bodyHtml,
        bodyText,
        bodyMjml: "",
        status: "draft",
        generatedBy: "worker:assembleWeeklyDigestEmail",
      },
    });

    createdCampaigns.push({ id: campaign.id, segmentTag: segment });

    logger.info(
      { campaignId: campaign.id, segment, postId },
      "assembleWeeklyDigestEmail: EmailCampaign draft created"
    );
  }

  // 5. Log generation costs
  logger.info(
    {
      postId,
      totalCostAud: totalCostAud.toFixed(4),
      campaignCount: createdCampaigns.length,
    },
    "assembleWeeklyDigestEmail: all segments generated"
  );

  // 6. Send notification to admin
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    logger.warn("assembleWeeklyDigestEmail: no admin emails configured, skipping notification");
    return;
  }

  const campaignListHtml = createdCampaigns
    .map(
      (c) =>
        `<li><a href="${SITE_URL}/admin/campaigns/${c.id}" style="color:#2563eb;">${segmentLabel(c.segmentTag as Segment)} — ${c.id}</a></li>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:24px;">
  <h2>Weekly digest email drafts ready for review</h2>
  <p>The following campaign drafts have been generated for the weekly digest:</p>
  <p><strong>${escapeHtml(post.title)}</strong></p>
  <ul>${campaignListHtml}</ul>
  <p style="color:#6b7280;font-size:13px;">Total generation cost: AUD $${totalCostAud.toFixed(4)}</p>
  <p><a href="${SITE_URL}/admin/campaigns" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Open campaign dashboard</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
  <p style="color:#9ca3af;font-size:12px;">TensorWorks automated email pipeline</p>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmails,
      subject: `[TensorWorks] Weekly digest email drafts ready: ${post.title}`,
      html,
    });
    logger.info(
      { recipientCount: adminEmails.length },
      "assembleWeeklyDigestEmail: admin notification sent"
    );
  } catch (err) {
    logger.error({ err }, "assembleWeeklyDigestEmail: failed to send admin notification");
  }
}

export async function processAssembleWeeklyDigestEmail(job: Job): Promise<void> {
  const { postId } = job.data as { postId: string };
  if (!postId) throw new Error("assembleWeeklyDigestEmail: missing postId in job data");
  await assembleWeeklyDigestEmail(postId);
}
