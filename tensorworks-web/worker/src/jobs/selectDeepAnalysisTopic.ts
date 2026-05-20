import type { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

/**
 * Returns the ISO Monday date of the week that starts 7 days after today.
 */
function nextWeekMonday(): Date {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysUntilNextMonday = ((1 - dayOfWeek + 7) % 7) + 7;
  const nextMonday = new Date(now);
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilNextMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);
  return nextMonday;
}

/**
 * BullMQ job processor: Mondays 1200 AEST.
 *
 * 1. Check editorial calendar for the upcoming week.
 * 2. If an adminOverride=true entry exists for next week: use it.
 * 3. Otherwise: pick the highest-priority "queued" entry.
 * 4. Mark selected entry status="assigned" with targetWeek.
 * 5. Log selected topic.
 */
export async function processSelectDeepAnalysisTopic(_job: Job): Promise<void> {
  logger.info("selectDeepAnalysisTopic: starting run");

  const targetWeek = nextWeekMonday();

  logger.info({ targetWeek: targetWeek.toISOString() }, "selectDeepAnalysisTopic: targeting week");

  // Check if a topic has already been assigned for next week
  const alreadyAssigned = await prisma.editorialCalendar.findFirst({
    where: {
      targetWeek,
      status: "assigned",
    },
  });

  if (alreadyAssigned) {
    logger.info(
      { entryId: alreadyAssigned.id, topic: alreadyAssigned.topic },
      "selectDeepAnalysisTopic: topic already assigned for next week, skipping"
    );
    return;
  }

  // 1. Look for an adminOverride entry targeting next week
  const overrideEntry = await prisma.editorialCalendar.findFirst({
    where: {
      adminOverride: true,
      status: "queued",
      targetWeek,
    },
    orderBy: { priority: "desc" },
  });

  const selectedEntry = overrideEntry ?? await prisma.editorialCalendar.findFirst({
    where: { status: "queued" },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  if (!selectedEntry) {
    logger.warn(
      "selectDeepAnalysisTopic: no queued editorial calendar entries found, skipping"
    );
    return;
  }

  await prisma.editorialCalendar.update({
    where: { id: selectedEntry.id },
    data: {
      status: "assigned",
      targetWeek,
    },
  });

  logger.info(
    {
      entryId: selectedEntry.id,
      topic: selectedEntry.topic,
      tier: selectedEntry.tier,
      priority: selectedEntry.priority,
      adminOverride: selectedEntry.adminOverride,
      targetWeek: targetWeek.toISOString(),
    },
    "selectDeepAnalysisTopic: topic selected and assigned for next week"
  );
}

/** Named export expected by index.ts */
export const selectDeepAnalysisTopicProcessor = processSelectDeepAnalysisTopic;
