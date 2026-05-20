/**
 * sendCampaigns
 *
 * Runs every Tuesday 10:00 AEST ("0 0 * * 2" — 00:00 UTC = 10:00 AEST)
 *
 * 1. Query EmailCampaign where status='scheduled' AND scheduledFor <= now()
 * 2. For each:
 *    a. Verify mailchimpCampaignId exists (if not: create it via Mailchimp API first)
 *    b. Call sendCampaignNow(mailchimpCampaignId)
 *    c. Update: status='sent', sentAt=now()
 * 3. On error: retry up to 3 times with 2min backoff, then status='failed' + alert admin
 */

import type { Job } from "bullmq";
import { Resend } from "resend";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { createCampaign, sendCampaignNow } from "../lib/mailchimp.js";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM_EMAIL = process.env.FROM_EMAIL ?? "noreply@tensorworks.com.au";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tensorworks.com.au";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2 * 60 * 1_000; // 2 minutes

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function alertAdminFailure(campaignId: string, err: unknown): Promise<void> {
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) return;

  const message = err instanceof Error ? err.message : String(err);

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmails,
      subject: `[TensorWorks] FAILED: Campaign send failed — ${campaignId}`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#dc2626;">Campaign send failed</h2>
  <p>Campaign <strong>${campaignId}</strong> failed to send after ${MAX_RETRIES} retries and has been marked as <code>failed</code>.</p>
  <p style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:4px;font-family:monospace;font-size:13px;">${message}</p>
  <p><a href="${SITE_URL}/admin/campaigns/${campaignId}" style="color:#2563eb;">View campaign</a></p>
</body>
</html>`,
    });
  } catch (sendErr) {
    logger.error({ sendErr }, "sendCampaigns: failed to send admin failure alert");
  }
}

export async function processSendCampaigns(_job: Job): Promise<void> {
  logger.info("sendCampaigns: starting run");

  const now = new Date();

  // 1. Query scheduled campaigns due to be sent
  const scheduledCampaigns = await prisma.emailCampaign.findMany({
    where: {
      status: "scheduled",
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: "asc" },
  });

  if (scheduledCampaigns.length === 0) {
    logger.info("sendCampaigns: no campaigns due for sending");
    return;
  }

  logger.info(
    { count: scheduledCampaigns.length },
    "sendCampaigns: campaigns to send"
  );

  for (const campaign of scheduledCampaigns) {
    logger.info(
      { campaignId: campaign.id, segmentTag: campaign.segmentTag },
      "sendCampaigns: sending campaign"
    );

    let mailchimpCampaignId = campaign.mailchimpCampaignId;
    let lastErr: unknown = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // 2a. Ensure Mailchimp campaign exists
        if (!mailchimpCampaignId) {
          logger.info(
            { campaignId: campaign.id },
            "sendCampaigns: no mailchimpCampaignId found — creating campaign in Mailchimp"
          );

          mailchimpCampaignId = await createCampaign({
            subject: campaign.subjectLine,
            previewText: campaign.previewText,
            htmlBody: campaign.bodyHtml,
            textBody: campaign.bodyText,
            segmentTag: campaign.segmentTag,
          });

          await prisma.emailCampaign.update({
            where: { id: campaign.id },
            data: { mailchimpCampaignId },
          });

          logger.info(
            { campaignId: campaign.id, mailchimpCampaignId },
            "sendCampaigns: Mailchimp campaign created"
          );
        }

        // 2b. Send
        await sendCampaignNow(mailchimpCampaignId);

        // 2c. Update status
        await prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            mailchimpCampaignId,
          },
        });

        logger.info(
          { campaignId: campaign.id, mailchimpCampaignId },
          "sendCampaigns: campaign sent successfully"
        );

        lastErr = null;
        break; // success — exit retry loop
      } catch (err) {
        lastErr = err;
        logger.warn(
          { campaignId: campaign.id, attempt, err },
          `sendCampaigns: send attempt ${attempt} failed`
        );

        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
        }
      }
    }

    // 3. If all retries exhausted: mark failed + alert admin
    if (lastErr !== null) {
      logger.error(
        { campaignId: campaign.id, err: lastErr },
        "sendCampaigns: campaign failed after all retries — marking as failed"
      );

      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { status: "failed" },
      });

      await alertAdminFailure(campaign.id, lastErr);
    }
  }

  logger.info("sendCampaigns: run complete");
}

export const sendCampaignsProcessor = processSendCampaigns;
