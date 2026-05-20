import { checkBannedPhrases } from "./bannedPhrases.js";
import { checkCopyright, isLikelyCopyrighted } from "./copyrightCheck.js";

export interface Citation {
  url: string;
  /** Raw source text, used for copyright checks (optional). */
  sourceText?: string;
}

export interface Post {
  title: string;
  body: string;
  citations: Citation[];
  tags: string[];
}

export interface QualityReport {
  passed: boolean;
  issues: string[];
  /** Aggregate quality score 0–100. Starts at 100, deducted per issue. */
  score: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function countH2Headings(body: string): number {
  return (body.match(/^#{2}\s+/gm) ?? []).length;
}

function isValidUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function urlIssues(citations: Citation[]): string[] {
  const issues: string[] = [];
  for (const c of citations) {
    if (!isValidUrl(c.url)) {
      issues.push(`Invalid citation URL: "${c.url}"`);
    }
  }
  return issues;
}

function buildReport(issues: string[]): QualityReport {
  const deductionPerIssue = issues.length === 0 ? 0 : Math.ceil(100 / Math.max(issues.length * 2, 5));
  const score = Math.max(0, 100 - issues.length * deductionPerIssue);
  return { passed: issues.length === 0, issues, score };
}

// ---------------------------------------------------------------------------
// Tier checks
// ---------------------------------------------------------------------------

export function checkDailyScan(post: Post): QualityReport {
  const issues: string[] = [];
  const wordCount = countWords(post.body);

  if (wordCount < 400 || wordCount > 800) {
    issues.push(
      `Word count ${wordCount} is outside the required range 400–800`
    );
  }

  if (post.citations.length < 2) {
    issues.push(
      `Insufficient citations: ${post.citations.length} (minimum 2 required)`
    );
  }

  const bannedMatches = checkBannedPhrases(`${post.title}\n${post.body}`);
  if (bannedMatches.length > 0) {
    issues.push(`Banned phrases detected: ${bannedMatches.join(", ")}`);
  }

  if (countH2Headings(post.body) < 1) {
    issues.push("Body must contain at least one H2 heading (## ...)");
  }

  issues.push(...urlIssues(post.citations));

  return buildReport(issues);
}

export function checkWeeklyDigest(post: Post): QualityReport {
  const issues: string[] = [];
  const wordCount = countWords(post.body);

  if (wordCount < 1200 || wordCount > 2500) {
    issues.push(
      `Word count ${wordCount} is outside the required range 1200–2500`
    );
  }

  if (post.citations.length < 5) {
    issues.push(
      `Insufficient citations: ${post.citations.length} (minimum 5 required)`
    );
  }

  const bannedMatches = checkBannedPhrases(`${post.title}\n${post.body}`);
  if (bannedMatches.length > 0) {
    issues.push(`Banned phrases detected: ${bannedMatches.join(", ")}`);
  }

  if (countH2Headings(post.body) < 3) {
    issues.push("Body must contain at least 3 H2 headings (## ...)");
  }

  issues.push(...urlIssues(post.citations));

  return buildReport(issues);
}

export function checkDeepAnalysis(
  post: Post,
  /** Optional: source texts aligned to citations for copyright check */
  sourceTexts: string[] | null
): QualityReport {
  const issues: string[] = [];
  const wordCount = countWords(post.body);

  if (wordCount < 2500 || wordCount > 6000) {
    issues.push(
      `Word count ${wordCount} is outside the required range 2500–6000`
    );
  }

  if (post.citations.length < 8) {
    issues.push(
      `Insufficient citations: ${post.citations.length} (minimum 8 required)`
    );
  }

  const bannedMatches = checkBannedPhrases(`${post.title}\n${post.body}`);
  if (bannedMatches.length > 0) {
    issues.push(`Banned phrases detected: ${bannedMatches.join(", ")}`);
  }

  if (countH2Headings(post.body) < 5) {
    issues.push("Body must contain at least 5 H2 headings (## ...)");
  }

  // Copyright check against each source
  if (sourceTexts) {
    for (let i = 0; i < sourceTexts.length; i++) {
      const score = checkCopyright(post.body, sourceTexts[i]);
      if (isLikelyCopyrighted(score)) {
        const url = post.citations[i]?.url ?? `source[${i}]`;
        issues.push(
          `High Jaccard similarity (${score.toFixed(3)}) with source: ${url}`
        );
      }
    }
  }

  issues.push(...urlIssues(post.citations));

  return buildReport(issues);
}

// ---------------------------------------------------------------------------
// Generic dispatcher
// ---------------------------------------------------------------------------

export function checkQuality(tier: string, post: Post): QualityReport {
  switch (tier) {
    case "daily-scan":
      return checkDailyScan(post);
    case "weekly-digest":
      return checkWeeklyDigest(post);
    case "deep-analysis":
      return checkDeepAnalysis(post, null);
    default:
      return buildReport([`Unknown quality tier: "${tier}"`]);
  }
}
