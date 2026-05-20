import type { Job } from "bullmq";
import { Resend } from "resend";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM_EMAIL = process.env.FROM_EMAIL ?? "noreply@tensorworks.com.au";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tensorworks.com.au";

/** Parse comma-separated admin emails from env. */
function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

function tierLabel(tier: string): string {
  switch (tier) {
    case "daily-scan":
      return "Daily Scan";
    case "weekly-digest":
      return "Weekly Digest";
    case "deep-analysis":
      return "Deep Analysis";
    default:
      return tier;
  }
}

function buildSinglePostHtml(post: {
  id: string;
  title: string;
  tier: string;
  wordCount: number;
  qualityScore?: number | null;
}): string {
  const adminUrl = `${SITE_URL}/admin/content/${post.id}`;
  const quality = post.qualityScore != null ? ` &mdash; quality score: ${post.qualityScore}/100` : "";

  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
        <strong><a href="${adminUrl}" style="color:#2563eb;text-decoration:none;">${escapeHtml(post.title)}</a></strong><br>
        <span style="color:#6b7280;font-size:14px;">
          ${escapeHtml(tierLabel(post.tier))} &bull; ${post.wordCount} words${quality}
        </span>
      </td>
    </tr>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Send an immediate email notification when a single post is ready for review.
 * Called directly from generation jobs.
 */
export async function sendImmediateReviewNotification(post: {
  id: string;
  title: string;
  tier: string;
  wordCount: number;
  qualityScore?: number | null;
}): Promise<void> {
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    logger.warn("notifyReview: no admin emails configured, skipping notification");
    return;
  }

  const adminUrl = `${SITE_URL}/admin/content/${post.id}`;
  const subject = `[TensorWorks] New ${tierLabel(post.tier)} ready for review: ${post.title}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#111827;margin-bottom:8px;">New post ready for review</h2>
  <p style="color:#6b7280;margin-top:0;">A new ${escapeHtml(tierLabel(post.tier))} post has been generated and is awaiting editorial review.</p>
  <table style="width:100%;border-collapse:collapse;">
    ${buildSinglePostHtml(post)}
  </table>
  <p style="margin-top:24px;">
    <a href="${adminUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Review post</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
  <p style="color:#9ca3af;font-size:12px;">TensorWorks automated content pipeline</p>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmails,
      subject,
      html,
    });

    logger.info(
      { postId: post.id, recipientCount: adminEmails.length },
      "notifyReview: immediate notification sent"
    );
  } catch (err) {
    logger.error({ postId: post.id, err }, "notifyReview: failed to send immediate notification");
  }
}

/**
 * BullMQ job processor: daily 0830 AEST cron.
 * Sends a digest of all pending_review posts.
 */
export async function processNotifyReview(_job: Job): Promise<void> {
  logger.info("notifyReview: starting daily digest run");

  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    logger.warn("notifyReview: no admin emails configured, skipping");
    return;
  }

  const pendingPosts = await prisma.blogPost.findMany({
    where: { status: "pending_review" },
    select: {
      id: true,
      title: true,
      tier: true,
      wordCount: true,
      createdAt: true,
      generationLog: { select: { qualityScore: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (pendingPosts.length === 0) {
    logger.info("notifyReview: no pending_review posts, skipping digest");
    return;
  }

  logger.info({ pendingCount: pendingPosts.length }, "notifyReview: sending daily digest");

  const subject = `[TensorWorks] ${pendingPosts.length} post${pendingPosts.length !== 1 ? "s" : ""} pending review`;

  const postRows = pendingPosts
    .map((p) =>
      buildSinglePostHtml({
        id: p.id,
        title: p.title,
        tier: p.tier,
        wordCount: p.wordCount,
        qualityScore: p.generationLog?.qualityScore ?? null,
      })
    )
    .join("");

  const adminDashboardUrl = `${SITE_URL}/admin/content`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#111827;margin-bottom:8px;">Daily content review digest</h2>
  <p style="color:#6b7280;margin-top:0;">${pendingPosts.length} post${pendingPosts.length !== 1 ? "s" : ""} awaiting editorial review.</p>
  <table style="width:100%;border-collapse:collapse;">
    ${postRows}
  </table>
  <p style="margin-top:24px;">
    <a href="${adminDashboardUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Open content dashboard</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
  <p style="color:#9ca3af;font-size:12px;">TensorWorks automated content pipeline &bull; Daily digest</p>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmails,
      subject,
      html,
    });

    logger.info(
      { pendingCount: pendingPosts.length, recipientCount: adminEmails.length },
      "notifyReview: daily digest sent"
    );
  } catch (err) {
    logger.error({ err }, "notifyReview: failed to send daily digest");
    throw err;
  }
}

/** Named export expected by index.ts */
export const notifyReviewProcessor = processNotifyReview;
