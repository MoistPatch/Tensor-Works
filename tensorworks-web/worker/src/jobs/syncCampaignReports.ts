/**
 * syncCampaignReports
 *
 * Runs daily 04:00 AEST ("0 18 * * *" — 18:00 UTC = 04:00 AEST)
 *
 * 1. Fetch EmailCampaigns with status='sent' AND sentAt >= 30 days ago AND mailchimpCampaignId IS NOT NULL
 * 2. For each: call getCampaignReport(mailchimpCampaignId)
 * 3. Update EmailCampaign: openCount, clickCount, unsubscribeCount, bounceCount, complaintCount
 */

import type { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { getCampaignReport } from "../lib/mailchimp.js";

export async function processSyncCampaignReports(_job: Job): Promise<void> {
  logger.info("syncCampaignReports: starting run");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);

  // 1. Fetch sent campaigns within the last 30 days with a Mailchimp campaign ID
  const sentCampaigns = await prisma.emailCampaign.findMany({
    where: {
      status: "sent",
      sentAt: { gte: thirtyDaysAgo },
      mailchimpCampaignId: { not: null },
    },
    select: {
      id: true,
      mailchimpCampaignId: true,
      sentAt: true,
      segmentTag: true,
    },
  });

  if (sentCampaigns.length === 0) {
    logger.info("syncCampaignReports: no sent campaigns to sync");
    return;
  }

  logger.info(
    { count: sentCampaigns.length },
    "syncCampaignReports: fetching reports for campaigns"
  );

  let updated = 0;
  let failed = 0;

  for (const campaign of sentCampaigns) {
    const mailchimpCampaignId = campaign.mailchimpCampaignId!;

    try {
      // 2. Fetch report from Mailchimp
      const report = await getCampaignReport(mailchimpCampaignId);

      if (!report) {
        logger.warn(
          { campaignId: campaign.id, mailchimpCampaignId },
          "syncCampaignReports: campaign report not found in Mailchimp (404), skipping"
        );
        continue;
      }

      // 3. Update the EmailCampaign record
      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: {
          openCount: report.opens,
          clickCount: report.clicks,
          unsubscribeCount: report.unsubscribes,
          bounceCount: report.bounces,
          complaintCount: report.complaints,
          deliveredCount: report.delivered,
        },
      });

      updated++;
      logger.info(
        {
          campaignId: campaign.id,
          mailchimpCampaignId,
          opens: report.opens,
          clicks: report.clicks,
          bounces: report.bounces,
          complaints: report.complaints,
        },
        "syncCampaignReports: report synced"
      );
    } catch (err) {
      failed++;
      logger.error(
        { campaignId: campaign.id, mailchimpCampaignId, err },
        "syncCampaignReports: failed to fetch/update report"
      );
    }
  }

  logger.info(
    { total: sentCampaigns.length, updated, failed },
    "syncCampaignReports: run complete"
  );
}

export const syncCampaignReportsProcessor = processSyncCampaignReports;
