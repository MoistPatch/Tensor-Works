/**
 * Patterns for phrases that must not appear in generated content.
 * All patterns are case-insensitive.
 */
export const BANNED_PHRASE_PATTERNS: RegExp[] = [
  /revolutionary/i,
  /cutting[- ]edge/i,
  /world[- ]class/i,
  /next[- ]generation/i,
  /breakthrough/i,
  /AI[- ]powered/i,
  /synergies?/i,
  // "leverage" only as a verb (followed by a noun phrase, not "ratio" / financial usage)
  /\bleverage\b(?!\s+ratio|\s+effect|\s+buyout)/i,
  // "unlock" as in "unlock potential / value / opportunities"
  /\bunlock\b/i,
  /supercharge/i,
  // "harness" as a verb — match when not followed by typical noun ("harness" the noun)
  /\bharness\b/i,
  /in today'?s fast[- ]paced world/i,
  /\bdelve\b/i,
  /dive deep/i,
  /navigate the landscape/i,
  /it'?s worth noting/i,
  /it is worth noting/i,
  /as an AI/i,
  /I cannot/i,
  /I'?m unable/i,
  /as a language model/i,
];

/**
 * Check text for banned phrases.
 * Returns an array of matched phrase strings (may contain duplicates if a
 * pattern matches multiple times, but each pattern is reported at most once).
 */
export function checkBannedPhrases(text: string): string[] {
  const matched: string[] = [];

  for (const pattern of BANNED_PHRASE_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      matched.push(match[0]);
    }
  }

  return matched;
}
