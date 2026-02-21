import type { ContentBlock, ContentGroup } from "./types.js";

function groupContentByHeadings(blocks: ContentBlock[]): ContentGroup[] {
  const groups: ContentGroup[] = [];
  let current: ContentGroup = { blocks: [], score: 0, collapsed: false };

  for (const block of blocks) {
    if (block.type === "heading") {
      if (current.blocks.length > 0 || current.heading) {
        groups.push(current);
      }
      current = {
        heading: { text: block.text, level: block.level ?? 2 },
        blocks: [],
        score: 0,
        collapsed: false,
      };
    } else {
      current.blocks.push(block);
    }
  }

  if (current.blocks.length > 0 || current.heading) {
    groups.push(current);
  }

  // If we have a single large headingless group, try to split it
  if (
    groups.length === 1 &&
    !groups[0].heading &&
    groups[0].blocks.length > 10
  ) {
    return splitLargeHeadinglessGroup(groups[0]);
  }

  return groups;
}

/**
 * A paragraph is "product-like" if it's under 10 words and has no
 * sentence-ending punctuation — i.e. it's a label, not prose.
 */
function isProductLike(block: ContentBlock): boolean {
  if (block.type !== "paragraph") return false;
  const words = block.text.split(/\s+/).length;
  if (words >= 10) return false;
  return !/[.!?]$/.test(block.text.trim());
}

function splitLargeHeadinglessGroup(group: ContentGroup): ContentGroup[] {
  const blocks = group.blocks;
  const productLikeCount = blocks.filter(isProductLike).length;
  const productLikeRatio = productLikeCount / blocks.length;

  // If >60% are product-like paragraphs, collapse the whole thing as noise
  if (productLikeRatio > 0.6) {
    return [{ ...group, collapsed: true }];
  }

  // Otherwise, split into chunks at natural boundaries:
  // after runs of 3+ product-like paragraphs
  const result: ContentGroup[] = [];
  let current: ContentBlock[] = [];
  let shortRun = 0;

  for (const block of blocks) {
    if (isProductLike(block)) {
      shortRun++;
    } else {
      shortRun = 0;
    }

    current.push(block);

    // Split after a run of 3+ product-like paragraphs (likely product listing noise)
    if (shortRun >= 3) {
      result.push({ blocks: current, score: 0, collapsed: true });
      current = [];
      shortRun = 0;
    }
  }

  if (current.length > 0) {
    result.push({ blocks: current, score: 0, collapsed: false });
  }

  return result;
}

function getDominantContext(
  blocks: ContentBlock[],
): "main" | "article" | "body" {
  const counts: Record<string, number> = { main: 0, article: 0, body: 0 };
  for (const block of blocks) {
    const ctx = block.sourceContext ?? "body";
    counts[ctx] = (counts[ctx] ?? 0) + 1;
  }
  if (counts.main >= counts.article && counts.main >= counts.body)
    return "main";
  if (counts.article >= counts.body) return "article";
  return "body";
}

function scoreContentGroup(
  group: ContentGroup,
  repetitionSet: Set<string>,
): number {
  let score = 0;
  let zeroOrNegativeCount = 0;

  for (const block of group.blocks) {
    let blockScore = 0;

    // Repetition penalty: blocks seen 3+ times across all groups score -1
    if (repetitionSet.has(block.text)) {
      blockScore = -1;
    } else {
      switch (block.type) {
        case "paragraph": {
          const wordCount = block.text.split(/\s+/).length;
          // Minimum quality: paragraphs with fewer than 5 words score 0
          blockScore = wordCount >= 5 ? Math.min(wordCount / 10, 5) : 0;
          break;
        }
        case "list":
          blockScore = (block.items?.length ?? 0) * 0.5;
          break;
        case "image":
          blockScore = 3;
          break;
        case "blockquote":
          blockScore = 4;
          break;
        case "preformatted":
          blockScore = 4;
          break;
        case "table":
          blockScore = Math.min(3 + (block.rows?.length ?? 0) * 0.3, 10);
          break;
        case "definition-list":
          blockScore = Math.min((block.definitions?.length ?? 0) * 1.0, 8);
          break;
      }
    }

    if (blockScore <= 0) zeroOrNegativeCount++;
    score += blockScore;
  }

  // Source context bonus: applied once per group based on dominant context
  const dominantCtx = getDominantContext(group.blocks);
  if (dominantCtx === "main") {
    score += 2;
  } else if (dominantCtx === "article") {
    score += 1.5;
  }

  // Heading quality bonus: +2 if heading is 3-10 words
  if (group.heading) {
    const headingWords = group.heading.text.split(/\s+/).length;
    if (headingWords >= 3 && headingWords <= 10) {
      score += 2;
    }
  }

  // Penalize groups with high noise ratio (>60% zero-or-negative blocks)
  if (
    group.blocks.length > 0 &&
    zeroOrNegativeCount / group.blocks.length > 0.6
  ) {
    score *= 0.5;
  }

  return score;
}

function buildRepetitionSet(groups: ContentGroup[]): Set<string> {
  const freq = new Map<string, number>();
  for (const group of groups) {
    for (const block of group.blocks) {
      freq.set(block.text, (freq.get(block.text) ?? 0) + 1);
    }
  }
  const repeated = new Set<string>();
  for (const [text, count] of freq) {
    if (count >= 3) repeated.add(text);
  }
  return repeated;
}

function markCollapsedGroups(
  groups: ContentGroup[],
  threshold: number = 5,
): ContentGroup[] {
  return groups.map((group) => ({
    ...group,
    collapsed: group.score < threshold,
  }));
}

export function groupAndScoreContent(blocks: ContentBlock[]): ContentGroup[] {
  const groups = groupContentByHeadings(blocks);

  // Build repetition set across all groups before scoring
  const repetitionSet = buildRepetitionSet(groups);

  for (const group of groups) {
    group.score = scoreContentGroup(group, repetitionSet);
  }

  // Adaptive threshold: max(5, median score)
  const scores = groups.map((g) => g.score).sort((a, b) => a - b);
  const median =
    scores.length > 0
      ? scores.length % 2 === 1
        ? scores[Math.floor(scores.length / 2)]
        : (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2
      : 0;
  const threshold = Math.max(5, median);

  return markCollapsedGroups(groups, threshold);
}
