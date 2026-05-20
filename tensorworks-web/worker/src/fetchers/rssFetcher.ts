import Parser from "rss-parser";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import type { NewsSource } from "@prisma/client";

export interface NewsItem {
  sourceId: string;
  externalId: string | null;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date | null;
}

const parser = new Parser({
  timeout: 15_000,
  headers: {
    "User-Agent": "TensorWorks-NewsBot/1.0 (+https://tensorworks.com.au)",
  },
});

/**
 * Fetches and parses an RSS/Atom feed for the given NewsSource.
 * Deduplicates against existing DB records and returns only new items.
 */
export async function fetchRssFeed(source: NewsSource): Promise<NewsItem[]> {
  if (!source.feedUrl) {
    logger.warn({ sourceId: source.id, sourceName: source.name }, "RSS source has no feedUrl, skipping");
    return [];
  }

  logger.info({ sourceId: source.id, feedUrl: source.feedUrl }, "Fetching RSS feed");

  let feed: Parser.Output<Record<string, unknown>>;
  try {
    feed = await parser.parseURL(source.feedUrl);
  } catch (err) {
    logger.error({ sourceId: source.id, feedUrl: source.feedUrl, err }, "Failed to fetch RSS feed");

    // Increment error count
    await prisma.newsSource.update({
      where: { id: source.id },
      data: { fetchErrors: { increment: 1 } },
    });

    return [];
  }

  const items = feed.items ?? [];
  if (items.length === 0) {
    logger.info({ sourceId: source.id }, "RSS feed returned no items");
    return [];
  }

  // Collect candidate URLs
  const candidateUrls = items
    .map((item) => item.link)
    .filter((url): url is string => typeof url === "string" && url.length > 0);

  // Fetch existing URLs from DB for this source in one query
  const existing = await prisma.newsItem.findMany({
    where: {
      sourceId: source.id,
      url: { in: candidateUrls },
    },
    select: { url: true },
  });
  const existingUrls = new Set(existing.map((e) => e.url));

  // Map feed items to NewsItem shape, filtering duplicates
  const newItems: NewsItem[] = [];
  for (const item of items) {
    const url = item.link;
    if (!url || existingUrls.has(url)) continue;

    const title = item.title?.trim() ?? "(untitled)";
    const summary = item.contentSnippet ?? item.summary ?? item.content ?? null;
    const publishedAt = item.isoDate
      ? new Date(item.isoDate)
      : item.pubDate
        ? new Date(item.pubDate)
        : null;

    const externalId = item.guid ?? item.id ?? null;

    newItems.push({
      sourceId: source.id,
      externalId: typeof externalId === "string" ? externalId : null,
      title,
      url,
      summary: typeof summary === "string" ? summary.slice(0, 2000) : null,
      publishedAt,
    });
  }

  logger.info(
    { sourceId: source.id, total: items.length, newCount: newItems.length },
    "RSS feed parsed"
  );

  return newItems;
}
