import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import type { NewsSource } from "@prisma/client";
import type { NewsItem } from "./rssFetcher.js";

const USER_AGENT = "TensorWorks-NewsBot/1.0 (+https://tensorworks.com.au)";
const FETCH_TIMEOUT_MS = 15_000;
const CRAWL_DELAY_MS = 1_000;

/**
 * Check whether the given URL is allowed to be fetched according to robots.txt.
 */
async function isAllowedByRobots(targetUrl: string): Promise<boolean> {
  let robotsUrl: string;
  try {
    const parsed = new URL(targetUrl);
    robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;
  } catch {
    // Unparseable URL — allow and let the fetch fail naturally
    return true;
  }

  try {
    const res = await fetch(robotsUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      // No robots.txt (404) or unreachable — assume allowed
      return true;
    }

    const text = await res.text();
    const robots = robotsParser(robotsUrl, text);
    return robots.isAllowed(targetUrl, USER_AGENT) !== false;
  } catch {
    // Could not retrieve robots.txt — assume allowed
    return true;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    return await res.text();
  } catch (err) {
    logger.warn({ url, err }, "scrapeFetcher: failed to fetch HTML");
    return null;
  }
}

/**
 * Extracts candidate article links from parsed HTML.
 * Looks for <a> elements with meaningful href and non-trivial text.
 */
function extractLinks(
  $: ReturnType<typeof cheerio.load>,
  baseUrl: string
): Array<{ title: string; url: string }> {
  const results: Array<{ title: string; url: string }> = [];
  const seen = new Set<string>();

  $("a[href]").each((_i, el) => {
    const rawHref = $(el).attr("href") ?? "";
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:")) return;

    let resolvedUrl: string;
    try {
      resolvedUrl = new URL(rawHref, baseUrl).href;
    } catch {
      return;
    }

    // Skip non-http(s), already-seen, or obvious non-article paths
    if (!resolvedUrl.startsWith("http")) return;
    if (seen.has(resolvedUrl)) return;
    if (/\.(css|js|png|jpe?g|gif|svg|ico|woff2?|ttf|pdf|zip)(\?|$)/i.test(resolvedUrl)) return;

    const title = $(el).text().trim().replace(/\s+/g, " ");
    if (title.length < 10 || title.length > 300) return;

    seen.add(resolvedUrl);
    results.push({ title, url: resolvedUrl });
  });

  return results;
}

/**
 * Scrapes a source URL using cheerio, respecting robots.txt.
 * Returns only items not already present in the database for this source.
 * A 1-second delay is inserted before each fetch to be polite.
 */
export async function scrapeSource(source: NewsSource): Promise<NewsItem[]> {
  const targetUrl = source.feedUrl ?? source.url;

  logger.info(
    { sourceId: source.id, sourceName: source.name, targetUrl },
    "Scraping source"
  );

  // Respect robots.txt
  const allowed = await isAllowedByRobots(targetUrl);
  if (!allowed) {
    logger.warn(
      { sourceId: source.id, targetUrl },
      "robots.txt disallows scraping this URL, skipping"
    );
    return [];
  }

  // Polite crawl delay
  await new Promise((resolve) => setTimeout(resolve, CRAWL_DELAY_MS));

  const html = await fetchHtml(targetUrl);
  if (!html) {
    await prisma.newsSource.update({
      where: { id: source.id },
      data: { fetchErrors: { increment: 1 } },
    });
    return [];
  }

  const $ = cheerio.load(html);
  const candidates = extractLinks($, targetUrl);

  if (candidates.length === 0) {
    logger.info({ sourceId: source.id }, "Scraper found no article links");
    return [];
  }

  // Deduplicate against DB
  const candidateUrls = candidates.map((c) => c.url);
  const existing = await prisma.newsItem.findMany({
    where: {
      sourceId: source.id,
      url: { in: candidateUrls },
    },
    select: { url: true },
  });
  const existingUrls = new Set(existing.map((e) => e.url));

  const newItems: NewsItem[] = candidates
    .filter((c) => !existingUrls.has(c.url))
    .map((c) => ({
      sourceId: source.id,
      externalId: null,
      title: c.title,
      url: c.url,
      summary: null,
      publishedAt: null,
    }));

  logger.info(
    {
      sourceId: source.id,
      total: candidates.length,
      newCount: newItems.length,
    },
    "Scrape complete"
  );

  return newItems;
}
