import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import type { NewsSource } from "@prisma/client";
import type { NewsItem } from "./rssFetcher.js";

/**
 * Generic JSON API fetcher.
 * Supports sources that expose a JSON API endpoint (e.g. HackerNews, arXiv).
 * Performs a best-effort transform of the response into NewsItem shape.
 */
export async function fetchApiSource(source: NewsSource): Promise<NewsItem[]> {
  if (!source.feedUrl) {
    logger.warn(
      { sourceId: source.id, sourceName: source.name },
      "API source has no feedUrl, skipping"
    );
    return [];
  }

  logger.info({ sourceId: source.id, feedUrl: source.feedUrl }, "Fetching API source");

  let raw: unknown;
  try {
    const res = await fetch(source.feedUrl, {
      headers: {
        "User-Agent": "TensorWorks-NewsBot/1.0 (+https://tensorworks.com.au)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    raw = await res.json();
  } catch (err) {
    logger.error(
      { sourceId: source.id, feedUrl: source.feedUrl, err },
      "Failed to fetch API source"
    );

    await prisma.newsSource.update({
      where: { id: source.id },
      data: { fetchErrors: { increment: 1 } },
    });

    return [];
  }

  // Normalise the response to an array of candidate items
  const candidates = normaliseCandidates(raw);

  if (candidates.length === 0) {
    logger.info({ sourceId: source.id }, "API source returned no parseable items");
    return [];
  }

  // Collect URLs so we can check for duplicates in one query
  const candidateUrls = candidates
    .map((c) => c.url)
    .filter((u): u is string => typeof u === "string" && u.length > 0);

  const existing = await prisma.newsItem.findMany({
    where: {
      sourceId: source.id,
      url: { in: candidateUrls },
    },
    select: { url: true },
  });
  const existingUrls = new Set(existing.map((e) => e.url));

  const newItems: NewsItem[] = [];
  for (const c of candidates) {
    if (!c.url || existingUrls.has(c.url)) continue;

    newItems.push({
      sourceId: source.id,
      externalId: c.externalId ?? null,
      title: c.title?.trim() ?? "(untitled)",
      url: c.url,
      summary: c.summary ? String(c.summary).slice(0, 2000) : null,
      publishedAt: c.publishedAt ?? null,
    });
  }

  logger.info(
    { sourceId: source.id, total: candidates.length, newCount: newItems.length },
    "API source parsed"
  );

  return newItems;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface RawCandidate {
  url?: string;
  externalId?: string;
  title?: string;
  summary?: string;
  publishedAt?: Date | null;
}

/**
 * Best-effort normalisation of an unknown JSON payload into an array of
 * candidate objects with recognisable url/title/summary/publishedAt fields.
 */
function normaliseCandidates(raw: unknown): RawCandidate[] {
  const arr = Array.isArray(raw) ? raw : (raw as Record<string, unknown>)?.hits
    ?? (raw as Record<string, unknown>)?.items
    ?? (raw as Record<string, unknown>)?.entries
    ?? (raw as Record<string, unknown>)?.results
    ?? (raw as Record<string, unknown>)?.data;

  if (!Array.isArray(arr)) return [];

  return (arr as Record<string, unknown>[]).map((item) => {
    const url = extractString(item, [
      "url", "link", "href", "story_url", "permalink",
    ]);
    const externalId = extractString(item, [
      "id", "objectID", "guid", "externalId",
    ]);
    const title = extractString(item, [
      "title", "name", "headline", "subject",
    ]);
    const summary = extractString(item, [
      "summary", "description", "text", "body", "content",
      "contentSnippet", "abstract",
    ]);

    const rawDate = item["published_at"] ?? item["publishedAt"] ?? item["pubDate"]
      ?? item["created_at"] ?? item["isoDate"] ?? item["date"];
    let publishedAt: Date | null = null;
    if (typeof rawDate === "string" || typeof rawDate === "number") {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) publishedAt = d;
    }

    return { url: url ?? undefined, externalId: externalId ?? undefined, title: title ?? undefined, summary: summary ?? undefined, publishedAt };
  });
}

function extractString(
  obj: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
  }
  return null;
}
