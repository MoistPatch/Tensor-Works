import type { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { fetchRssFeed } from "../fetchers/rssFetcher.js";
import { fetchApiSource } from "../fetchers/apiFetcher.js";
import { scrapeSource } from "../fetchers/scrapeFetcher.js";
import type { NewsItem } from "../fetchers/rssFetcher.js";

/**
 * BullMQ job processor: runs every 30 minutes.
 *
 * 1. Load all active NewsSource records from DB.
 * 2. For each source dispatch to the appropriate fetcher (rss/api/scrape).
 * 3. Batch-insert new NewsItems.
 * 4. Update source.lastFetchedAt.
 * 5. Log summary.
 */
export async function processMonitorSources(_job: Job): Promise<void> {
  logger.info("monitorSources: starting run");

  const sources = await prisma.newsSource.findMany({
    where: { active: true },
  });

  logger.info({ sourceCount: sources.length }, "monitorSources: loaded active sources");

  let totalNew = 0;
  let totalErrors = 0;

  for (const source of sources) {
    let items: NewsItem[] = [];

    try {
      switch (source.fetchType) {
        case "rss":
          items = await fetchRssFeed(source);
          break;
        case "api":
          items = await fetchApiSource(source);
          break;
        case "scrape":
          items = await scrapeSource(source);
          break;
        default:
          logger.warn(
            { sourceId: source.id, fetchType: source.fetchType },
            "monitorSources: unknown fetchType, skipping"
          );
          continue;
      }
    } catch (err) {
      logger.error(
        { sourceId: source.id, sourceName: source.name, err },
        "monitorSources: fetcher threw unexpectedly"
      );
      totalErrors++;

      await prisma.newsSource.update({
        where: { id: source.id },
        data: { fetchErrors: { increment: 1 } },
      }).catch((updateErr) => {
        logger.error({ sourceId: source.id, updateErr }, "monitorSources: failed to update fetchErrors");
      });

      continue;
    }

    if (items.length > 0) {
      try {
        await prisma.newsItem.createMany({
          data: items.map((item) => ({
            sourceId: item.sourceId,
            externalId: item.externalId,
            title: item.title,
            url: item.url,
            summary: item.summary,
            publishedAt: item.publishedAt,
          })),
          skipDuplicates: true,
        });

        totalNew += items.length;
      } catch (err) {
        logger.error(
          { sourceId: source.id, itemCount: items.length, err },
          "monitorSources: failed to insert news items"
        );
        totalErrors++;
      }
    }

    // Update lastFetchedAt regardless of whether new items were found
    await prisma.newsSource.update({
      where: { id: source.id },
      data: { lastFetchedAt: new Date() },
    }).catch((err) => {
      logger.error(
        { sourceId: source.id, err },
        "monitorSources: failed to update lastFetchedAt"
      );
    });
  }

  logger.info(
    {
      sourcesChecked: sources.length,
      newItems: totalNew,
      errors: totalErrors,
    },
    "monitorSources: run complete"
  );
}

/** Named export expected by index.ts */
export const monitorSourcesProcessor = processMonitorSources;
