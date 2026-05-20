/**
 * 8-gram Jaccard overlap copyright check.
 *
 * Extracts overlapping n-grams (sequences of n whitespace-delimited tokens)
 * from text and computes Jaccard similarity between two texts.
 * A similarity >= 0.15 is considered likely copyrighted.
 */

/**
 * Tokenise text into lowercase words, then extract all overlapping n-grams.
 */
export function extractNgrams(text: string, n: number): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const ngrams = new Set<string>();

  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.add(tokens.slice(i, i + n).join(" "));
  }

  return ngrams;
}

/**
 * Compute Jaccard similarity: |A ∩ B| / |A ∪ B|.
 * Returns 0 if either set is empty.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let intersectionSize = 0;
  for (const item of a) {
    if (b.has(item)) intersectionSize++;
  }

  const unionSize = a.size + b.size - intersectionSize;
  return intersectionSize / unionSize;
}

/**
 * Compute 8-gram Jaccard similarity between generated text and a source text.
 * Returns a value in [0, 1].
 */
export function checkCopyright(generated: string, source: string): number {
  const N = 8;
  const generatedGrams = extractNgrams(generated, N);
  const sourceGrams = extractNgrams(source, N);
  return jaccardSimilarity(generatedGrams, sourceGrams);
}

const COPYRIGHT_THRESHOLD = 0.15;

/**
 * Returns true if the Jaccard similarity score suggests likely copying.
 */
export function isLikelyCopyrighted(score: number): boolean {
  return score >= COPYRIGHT_THRESHOLD;
}
