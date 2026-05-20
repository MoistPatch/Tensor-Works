/**
 * bounceRateAudit
 *
 * Runs daily 08:00 AEST ("0 22 * * *" — 22:00 UTC = 08:00 AEST)
 * Also triggered manually from sendCampaigns with a 24h delay.
 *
 * 1. Fetch sent campaigns from last 48h
 * 2. For each: calculate bounceRate = bounceCount / recipientCount
 *              complaintRate = complaintCount / recipientCount
 * 3. If bounceRate > 8%: log alert + send admin warning email
 * 4. If complaintRate > 0.1%: send urgent admin email + halt all scheduled
 *    campaigns for that segment
 */

import type { Job } from "bullmq";
import { Resend } from "resend";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM_EMAIL = process.env.FROM_EMAIL ?? "noreply@tensorworks.com.au";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tensorworks.com.au";

const BOUNCE_RATE_THRESHOLD = 0.08;   // 8%
const COMPLAINT_RATE_THRESHOLD = 0.001; // 0.1%

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

function pct(rate: number): string {
  return (rate * 100).toFixed(2) + "%";
}

async function sendBounceWarning(
  campaignId: string,
  segmentTag: string,
  bounceRate: number,
  bounceCount: number,
  recipientCount: number
): Promise<void> {
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) return;

  const subject = `[TensorWorks] WARNING: High bounce rate for campaign ${campaignId}`;
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#d97706;">⚠ High Bounce Rate Warning</h2>
  <p>Campaign <strong>${campaignId}</strong> (segment: <strong>${segmentTag}</strong>) has exceeded the bounce rate threshold.</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0;">
    <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Bounce Rate</td><td style="padding:8px;border:1px solid #e5e7eb;color:#dc2626;font-weight:700;">${pct(bounceRate)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e5e7eb;">Bounces</td><td style="padding:8px;border:1px solid #e5e7eb;">${bounceCount}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e5e7eb;">Recipients</td><td style="padding:8px;border:1px solid #e5e7eb;">${recipientCount}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e5e7eb;">Threshold</td><td style="padding:8px;border:1px solid #e5e7eb;">${pct(BOUNCE_RATE_THRESHOLD)}</td></tr>
  </table>
  <p>Please review your list hygiene and consider suppressing invalid addresses.</p>
  <p><a href="${SITE_URL}/admin/campaigns/${campaignId}" style="color:#2563eb;">View campaign</a></p>
</body>
</html>`;

  try {
    await resend.emails.send({ from: FROM_EMAIL, to: adminEmails, subject, html });
    logger.info({ campaignId, recipientCount: adminEmails.length }, "bounceRateAudit: bounce warning sent to admin");
  } catch (err) {
    logger.error({ campaignId, err }, "bounceRateAudit: failed to send bounce warning");
  }
}

async function sendComplaintAlert(
  campaignId: string,
  segmentTag: string,
  complaintRate: number,
  complaintCount: number,
  recipientCount: number,
  haltedCount: number
): Promise<void> {
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) return;

  const subject = `[TensorWorks] URGENT: Complaint rate exceeded for campaign ${campaignId}`;
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#dc2626;">🚨 URGENT: Complaint Rate Threshold Exceeded</h2>
  <p>Campaign <strong>${campaignId}</strong> (segment: <strong>${segmentTag}</strong>) has exceeded the spam complaint rate threshold.</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0;">
    <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Complaint Rate</td><td style="padding:8px;border:1px solid #e5e7eb;color:#dc2626;font-weight:700;">${pct(complaintRate)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e5e7eb;">Complaints</td><td style="padding:8px;border:1px solid #e5e7eb;">${complaintCount}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e5e7eb;">Recipients</td><td style="padding:8px;border:1px solid #e5e7eb;">${recipientCount}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e5e7eb;">Threshold</td><td style="padding:8px;border:1px solid #e5e7eb;">${pct(COMPLAINT_RATE_THRESHOLD)}</td></tr>
  </table>
  <p><strong>${haltedCount} scheduled campaign(s)</strong> for segment <strong>${segmentTag}</strong> have been halted (marked as <code>failed</code>) pending review.</p>
  <p style="color:#dc2626;font-weight:600;">Immediate action required to protect sender reputation.</p>
  <p><a href="${SITE_URL}/admin/campaigns" style="color:#2563eb;">View campaigns dashboard</a></p>
</body>
</html>`;

  try {
    await resend.emails.send({ from: FROM_EMAIL, to: adminEmails, subject, html });
    logger.info({ campaignId, recipientCount: adminEmails.length }, "bounceRateAudit: complaint alert sent to admin");
  } catch (err) {
    logger.error({ campaignId, err }, "bounceRateAudit: failed to send complaint alert");
  }
}

export async function processBounceRateAudit(_job: Job): Promise<void> {
  logger.info("bounceRateAudit: starting run");

  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1_000);

  // 1. Fetch sent campaigns from last 48h with stats
  const recentCampaigns = await prisma.emailCampaign.findMany({
    where: {
      status: "sent",
      sentAt: { gte: fortyEightHoursAgo },
    },
    select: {
      id: true,
      segmentTag: true,
      bounceCount: true,
      complaintCount: true,
      recipientCount: true,
      deliveredCount: true,
      sentAt: true,
    },
  });

  if (recentCampaigns.length === 0) {
    logger.info("bounceRateAudit: no recently sent campaigns to audit");
    return;
  }

  logger.info(
    { count: recentCampaigns.length },
    "bounceRateAudit: auditing campaigns"
  );

  for (const campaign of recentCampaigns) {
    const recipients = campaign.recipientCount ?? campaign.deliveredCount ?? 0;

    if (recipients === 0) {
      logger.info(
        { campaignId: campaign.id },
        "bounceRateAudit: no recipient count available, skipping"
      );
      continue;
    }

    const bounceCount = campaign.bounceCount ?? 0;
    const complaintCount = campaign.complaintCount ?? 0;
    const bounceRate = bounceCount / recipients;
    const complaintRate = complaintCount / recipients;

    logger.info(
      {
        campaignId: campaign.id,
        segmentTag: campaign.segmentTag,
        bounceRate: pct(bounceRate),
        complaintRate: pct(complaintRate),
      },
      "bounceRateAudit: campaign stats"
    );

    // 3. High bounce rate alert
    if (bounceRate > BOUNCE_RATE_THRESHOLD) {
      logger.warn(
        {
          campaignId: campaign.id,
          bounceRate: pct(bounceRate),
          threshold: pct(BOUNCE_RATE_THRESHOLD),
        },
        "bounceRateAudit: ALERT — bounce rate exceeds threshold"
      );

      await sendBounceWarning(
        campaign.id,
        campaign.segmentTag,
        bounceRate,
        bounceCount,
        recipients
      );
    }

    // 4. High complaint rate: urgent alert + halt scheduled campaigns for segment
    if (complaintRate > COMPLAINT_RATE_THRESHOLD) {
      logger.error(
        {
          campaignId: campaign.id,
          segmentTag: campaign.segmentTag,
          complaintRate: pct(complaintRate),
          threshold: pct(COMPLAINT_RATE_THRESHOLD),
        },
        "bounceRateAudit: URGENT — complaint rate exceeds threshold, halting segment campaigns"
      );

      // Halt all scheduled campaigns for this segment
      const haltResult = await prisma.emailCampaign.updateMany({
        where: {
          segmentTag: campaign.segmentTag,
          status: "scheduled",
        },
        data: { status: "failed" },
      });

      const haltedCount = haltResult.count;

      logger.error(
        { segmentTag: campaign.segmentTag, haltedCount },
        "bounceRateAudit: halted scheduled campaigns for segment"
      );

      await sendComplaintAlert(
        campaign.id,
        campaign.segmentTag,
        complaintRate,
        complaintCount,
        recipients,
        haltedCount
      );
    }
  }

  logger.info("bounceRateAudit: run complete");
}

export const bounceRateAuditProcessor = processBounceRateAudit;
