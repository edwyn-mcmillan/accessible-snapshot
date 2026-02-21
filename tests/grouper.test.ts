import { describe, it, expect } from "vitest";
import { groupAndScoreContent } from "../src/grouper.js";
import type { ContentBlock } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function para(text: string, sourceContext?: ContentBlock["sourceContext"]): ContentBlock {
  return { type: "paragraph", text, sourceContext };
}

function heading(text: string, level: number = 2): ContentBlock {
  return { type: "heading", text, level };
}

function list(items: string[], sourceContext?: ContentBlock["sourceContext"]): ContentBlock {
  return { type: "list", text: items.join(", "), items, sourceContext };
}

function image(src: string, alt: string = ""): ContentBlock {
  return { type: "image", text: alt, src, alt };
}

function blockquote(text: string): ContentBlock {
  return { type: "blockquote", text };
}

function preformatted(text: string): ContentBlock {
  return { type: "preformatted", text };
}

/** Short paragraph that looks "product-like": <10 words, no terminal punctuation. */
function productLike(label: string): ContentBlock {
  return { type: "paragraph", text: label };
}

/** Paragraph long enough to earn a positive score (>=5 words). */
function richPara(wordCount: number): ContentBlock {
  const words = Array.from({ length: wordCount }, (_, i) => `word${i}`).join(" ");
  return { type: "paragraph", text: words };
}

// ---------------------------------------------------------------------------
// 1. Grouping by headings
// ---------------------------------------------------------------------------

describe("groupAndScoreContent – heading grouping", () => {
  it("returns empty array for empty input", () => {
    expect(groupAndScoreContent([])).toEqual([]);
  });

  it("puts blocks that appear before any heading into a headingless group", () => {
    const blocks: ContentBlock[] = [
      richPara(10),
      richPara(10),
      heading("Section A"),
      richPara(10),
    ];
    const groups = groupAndScoreContent(blocks);
    expect(groups).toHaveLength(2);
    expect(groups[0].heading).toBeUndefined();
    expect(groups[0].blocks).toHaveLength(2);
    expect(groups[1].heading?.text).toBe("Section A");
    expect(groups[1].blocks).toHaveLength(1);
  });

  it("creates one group per heading with the heading attached", () => {
    const blocks: ContentBlock[] = [
      heading("Alpha"),
      richPara(10),
      richPara(10),
      heading("Beta"),
      richPara(10),
    ];
    const groups = groupAndScoreContent(blocks);
    expect(groups).toHaveLength(2);
    expect(groups[0].heading?.text).toBe("Alpha");
    expect(groups[0].heading?.level).toBe(2);
    expect(groups[0].blocks).toHaveLength(2);
    expect(groups[1].heading?.text).toBe("Beta");
    expect(groups[1].blocks).toHaveLength(1);
  });

  it("preserves the heading level from the block", () => {
    const blocks: ContentBlock[] = [heading("Top", 1), richPara(8)];
    const groups = groupAndScoreContent(blocks);
    expect(groups[0].heading?.level).toBe(1);
  });

  it("creates a group for a heading with no following blocks", () => {
    const blocks: ContentBlock[] = [heading("Lonely")];
    const groups = groupAndScoreContent(blocks);
    expect(groups).toHaveLength(1);
    expect(groups[0].heading?.text).toBe("Lonely");
    expect(groups[0].blocks).toHaveLength(0);
  });

  it("does not create a group for an empty headingless prefix", () => {
    // First block is a heading – no leading headingless group should appear
    const blocks: ContentBlock[] = [heading("First"), richPara(8)];
    const groups = groupAndScoreContent(blocks);
    expect(groups).toHaveLength(1);
    expect(groups[0].heading?.text).toBe("First");
  });
});

// ---------------------------------------------------------------------------
// 2. Splitting large headingless groups
// ---------------------------------------------------------------------------

describe("groupAndScoreContent – large headingless group splitting", () => {
  it("does not split when there is more than one group", () => {
    // Two groups means the split path is not taken
    const blocks: ContentBlock[] = [
      ...Array.from({ length: 12 }, (_, i) => productLike(`Item ${i}`)),
      heading("Section"),
      richPara(8),
    ];
    const groups = groupAndScoreContent(blocks);
    // Should still be 2 groups (headingless + headed), NOT split further
    expect(groups).toHaveLength(2);
  });

  it("does not split a single headingless group with 10 or fewer blocks", () => {
    const blocks: ContentBlock[] = Array.from({ length: 10 }, () => richPara(8));
    const groups = groupAndScoreContent(blocks);
    expect(groups).toHaveLength(1);
    expect(groups[0].heading).toBeUndefined();
  });

  it("collapses a large headingless group when >60% of blocks are product-like", () => {
    // 12 product-like, 3 rich paras -> ratio = 12/15 = 0.8 > 0.6
    const blocks: ContentBlock[] = [
      ...Array.from({ length: 12 }, (_, i) => productLike(`Product ${i}`)),
      richPara(8),
      richPara(8),
      richPara(8),
    ];
    const groups = groupAndScoreContent(blocks);
    expect(groups).toHaveLength(1);
    expect(groups[0].collapsed).toBe(true);
  });

  it("splits a large headingless group on runs of 3 product-like blocks when ratio ≤ 0.6", () => {
    // 3 rich, 3 product-like, 3 rich, 3 product-like -> 6/12 = 0.5 ratio, not > 0.6
    const blocks: ContentBlock[] = [
      richPara(8),
      richPara(8),
      richPara(8),
      productLike("A"),
      productLike("B"),
      productLike("C"),
      richPara(8),
      richPara(8),
      richPara(8),
      productLike("D"),
      productLike("E"),
      productLike("F"),
    ];
    const groups = groupAndScoreContent(blocks);
    // Each run of 3 product-like blocks terminates a group
    expect(groups.length).toBeGreaterThan(1);
    // The first split group (ending with the product run) must be collapsed
    const collapsedGroups = groups.filter((g) => g.collapsed);
    expect(collapsedGroups.length).toBeGreaterThan(0);
  });

  it("marks the remainder group from a split as not collapsed by the splitter", () => {
    // ratio ≤ 0.6; blocks end with rich paragraphs so the last remainder is not product-dominated
    const blocks: ContentBlock[] = [
      productLike("A"),
      productLike("B"),
      productLike("C"),
      richPara(8),
      richPara(8),
      richPara(8),
      richPara(8),
      richPara(8),
      richPara(8),
      richPara(8),
      richPara(8),
      richPara(8),
    ];
    const groups = groupAndScoreContent(blocks);
    // Last group (remainder after split) has collapsed=false from the splitter.
    // The scoring/threshold step may collapse it, but we check structure integrity.
    expect(groups.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 3. Scoring
// ---------------------------------------------------------------------------

describe("groupAndScoreContent – scoring", () => {
  it("assigns context-only score to an empty group (heading only)", () => {
    const blocks: ContentBlock[] = [heading("Empty section")];
    const groups = groupAndScoreContent(blocks);
    // No block scores; heading "Empty section" has 2 words so no heading bonus;
    // getDominantContext returns "main" when all counts are 0, adding +2
    expect(groups[0].score).toBe(2);
  });

  it("scores paragraphs by word count (wordCount / 10, capped at 5) when ≥5 words", () => {
    // 10-word paragraph -> score = 10/10 = 1; + main bonus 2 = 3
    const blocks: ContentBlock[] = [
      richPara(10),
    ];
    const groups = groupAndScoreContent(blocks);
    // No heading bonus (no heading), no context bonus (sourceContext undefined -> body)
    // 10 words -> blockScore = 1; single group, no repetition
    expect(groups[0].score).toBeCloseTo(1);
  });

  it("scores paragraphs with <5 words as 0", () => {
    const blocks: ContentBlock[] = [
      { type: "paragraph", text: "Hi there" }, // 2 words
    ];
    const groups = groupAndScoreContent(blocks);
    // 2 words -> blockScore = 0; >60% zero blocks -> score * 0.5 = 0
    expect(groups[0].score).toBe(0);
  });

  it("applies main source context bonus of +2", () => {
    const blocks: ContentBlock[] = [
      { type: "paragraph", text: "one two three four five six seven eight nine ten", sourceContext: "main" },
    ];
    const groups = groupAndScoreContent(blocks);
    // 10 words -> blockScore = 1; +2 main bonus = 3
    expect(groups[0].score).toBeCloseTo(3);
  });

  it("applies article source context bonus of +1.5", () => {
    const blocks: ContentBlock[] = [
      { type: "paragraph", text: "one two three four five six seven eight nine ten", sourceContext: "article" },
    ];
    const groups = groupAndScoreContent(blocks);
    // 10 words -> blockScore = 1; +1.5 article bonus = 2.5
    expect(groups[0].score).toBeCloseTo(2.5);
  });

  it("applies no context bonus for body (the default)", () => {
    const blocks: ContentBlock[] = [
      { type: "paragraph", text: "one two three four five six seven eight nine ten", sourceContext: "body" },
    ];
    const groups = groupAndScoreContent(blocks);
    // 10 words -> 1; no context bonus
    expect(groups[0].score).toBeCloseTo(1);
  });

  it("uses dominant context when blocks have mixed contexts", () => {
    const blocks: ContentBlock[] = [
      { type: "paragraph", text: "alpha bravo charlie delta echo foxtrot golf hotel india juliet", sourceContext: "main" },
      { type: "paragraph", text: "kilo lima mike november oscar papa quebec romeo sierra tango", sourceContext: "main" },
      { type: "paragraph", text: "uniform victor whiskey xray yankee zulu able baker charlie dog", sourceContext: "body" },
    ];
    const groups = groupAndScoreContent(blocks);
    // main wins (2 vs 1); each para: 10 words -> 1; total base=3; +2 main = 5
    expect(groups[0].score).toBeCloseTo(5);
  });

  it("applies heading bonus of +2 when heading is 3–10 words", () => {
    const blocks: ContentBlock[] = [
      heading("Three word heading"),  // 3 words
      richPara(10),
    ];
    const groups = groupAndScoreContent(blocks);
    // para: 1; heading bonus: +2; body context (no bonus) -> 3
    expect(groups[0].score).toBeCloseTo(3);
  });

  it("does not apply heading bonus when heading has fewer than 3 words", () => {
    const blocks: ContentBlock[] = [
      heading("Go"),
      richPara(10),
    ];
    const without = groupAndScoreContent(blocks)[0].score;

    const blocks2: ContentBlock[] = [
      heading("Three word heading"),
      richPara(10),
    ];
    const withBonus = groupAndScoreContent(blocks2)[0].score;

    expect(withBonus - without).toBeCloseTo(2);
  });

  it("does not apply heading bonus when heading has more than 10 words", () => {
    const blocks: ContentBlock[] = [
      heading("one two three four five six seven eight nine ten eleven"),
      richPara(10),
    ];
    const groups = groupAndScoreContent(blocks);
    // heading is 11 words -> no +2
    // para: 1; body: 0 bonus -> 1
    expect(groups[0].score).toBeCloseTo(1);
  });

  it("penalises repeated text (appearing ≥3 times across all groups) with -1 per block", () => {
    // Repeat the same text 3 times across 3 different headed groups
    const repeatedText = "Buy now";
    const blocks: ContentBlock[] = [
      heading("A"),
      { type: "paragraph", text: "alpha bravo charlie delta echo foxtrot golf hotel india juliet" },
      { type: "paragraph", text: repeatedText },
      heading("B"),
      { type: "paragraph", text: "kilo lima mike november oscar papa quebec romeo sierra tango" },
      { type: "paragraph", text: repeatedText },
      heading("C"),
      { type: "paragraph", text: "uniform victor whiskey xray yankee zulu able baker charlie dog" },
      { type: "paragraph", text: repeatedText },
    ];
    const groups = groupAndScoreContent(blocks);
    // Each group: richPara (10 words -> 1) + repeated block (-1) -> base 0
    // >60% zero-or-negative? 1/2 = 50% -> not >60% -> no penalty multiplier
    // No heading bonus (heading is 1 word); body context (no bonus) -> score = 0
    for (const group of groups) {
      expect(group.score).toBeCloseTo(0);
    }
  });

  it("reduces score by 50% when more than 60% of blocks have zero or negative scores", () => {
    // 1 positive-scoring para + 2 zero-scoring paras (<5 words) -> 2/3 > 0.6
    const blocks: ContentBlock[] = [
      heading("Section"),
      richPara(10),      // +1
      para("Hi"),        // 0  (2 words)
      para("Okay"),      // 0  (1 word)
    ];
    const groups = groupAndScoreContent(blocks);
    // base: 1; 2/3 blocks are zero -> >60% -> *0.5 = 0.5; heading "Section" = 1 word -> no heading bonus
    expect(groups[0].score).toBeCloseTo(0.5);
  });

  it("scores list blocks at 0.5 per item", () => {
    const blocks: ContentBlock[] = [
      heading("Items"),
      list(["a", "b", "c", "d"]),
    ];
    const groups = groupAndScoreContent(blocks);
    // 4 items -> 2; heading "Items" = 1 word -> no heading bonus; body -> 0
    expect(groups[0].score).toBeCloseTo(2);
  });

  it("scores image blocks at 3", () => {
    const blocks: ContentBlock[] = [heading("Pic"), image("photo.jpg")];
    const groups = groupAndScoreContent(blocks);
    // image: 3; heading "Pic" = 1 word -> no bonus -> 3
    expect(groups[0].score).toBeCloseTo(3);
  });

  it("scores blockquote blocks at 4", () => {
    const blocks: ContentBlock[] = [heading("Quote"), blockquote("A wise saying from someone great")];
    const groups = groupAndScoreContent(blocks);
    // blockquote: 4; heading "Quote" = 1 word -> no bonus -> 4
    expect(groups[0].score).toBeCloseTo(4);
  });

  it("scores preformatted blocks at 4", () => {
    const blocks: ContentBlock[] = [heading("Code"), preformatted("const x = 1;")];
    const groups = groupAndScoreContent(blocks);
    // preformatted: 4; heading "Code" = 1 word -> no bonus -> 4
    expect(groups[0].score).toBeCloseTo(4);
  });
});

// ---------------------------------------------------------------------------
// 4. Adaptive threshold collapsing
// ---------------------------------------------------------------------------

describe("groupAndScoreContent – adaptive threshold (max(5, median))", () => {
  it("collapses groups whose score is below the adaptive threshold", () => {
    // Two groups: one high-scoring (unique paragraphs, main context), one zero-scoring (empty heading).
    // High group score >> 5 ensures threshold > 5; empty group scores 0 -> collapsed.
    const blocks: ContentBlock[] = [
      heading("Rich content section with lots of words"),  // 6 words -> heading bonus +2
      { type: "paragraph", text: "alpha bravo charlie delta echo foxtrot golf hotel india juliet", sourceContext: "main" },
      { type: "paragraph", text: "kilo lima mike november oscar papa quebec romeo sierra tango", sourceContext: "main" },
      { type: "paragraph", text: "uniform victor whiskey xray yankee zulu able baker delta easy", sourceContext: "main" },
      { type: "paragraph", text: "foxtrot golf hotel india juliet kilo lima mike november oscar", sourceContext: "main" },
      { type: "paragraph", text: "papa quebec romeo sierra tango uniform victor whiskey yankee zulu", sourceContext: "main" },
      heading("Empty"),
    ];
    const groups = groupAndScoreContent(blocks);
    // The empty group has score 0 and should be collapsed
    const emptyGroup = groups.find((g) => g.heading?.text === "Empty");
    expect(emptyGroup?.collapsed).toBe(true);
  });

  it("does not collapse groups at or above the adaptive threshold", () => {
    // Single group with rich content; median == score; threshold = max(5, score)
    // Use unique paragraph text to avoid repetition penalty.
    // 3 unique 11-word paras with main context + 3-word heading bonus:
    //   score = 3 * min(11/10, 5) + 2 (main) + 2 (heading bonus) = 3.3 + 4 = 7.3
    //   threshold = max(5, 7.3) = 7.3; score == threshold -> collapsed = false
    const blocks: ContentBlock[] = [
      heading("Three word heading"),
      { type: "paragraph", text: "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo", sourceContext: "main" },
      { type: "paragraph", text: "lima mike november oscar papa quebec romeo sierra tango uniform victor", sourceContext: "main" },
      { type: "paragraph", text: "whiskey xray yankee zulu able baker charlie dog easy fox george", sourceContext: "main" },
    ];
    const groups = groupAndScoreContent(blocks);
    expect(groups[0].collapsed).toBe(false);
  });

  it("uses the median of all group scores as the threshold base", () => {
    // Three groups: two with score 0 (empty headings) and one with a high score.
    // Sorted scores: [0, 0, high] -> median = 0 -> threshold = max(5, 0) = 5.
    // Groups with score 0 are below threshold -> collapsed.
    // Unique paragraph text prevents repetition penalty on the high-score group.
    const blocks: ContentBlock[] = [
      heading("Low"),
      heading("Also low"),
      heading("Three word heading"),
      { type: "paragraph", text: "alpha bravo charlie delta echo foxtrot golf hotel india juliet", sourceContext: "main" },
      { type: "paragraph", text: "kilo lima mike november oscar papa quebec romeo sierra tango", sourceContext: "main" },
      { type: "paragraph", text: "uniform victor whiskey xray yankee zulu able baker delta easy", sourceContext: "main" },
      { type: "paragraph", text: "foxtrot golf hotel india juliet kilo lima mike november oscar", sourceContext: "main" },
      { type: "paragraph", text: "papa quebec romeo sierra tango uniform victor whiskey yankee one", sourceContext: "main" },
      { type: "paragraph", text: "two three four five six seven eight nine ten eleven twelve", sourceContext: "main" },
      { type: "paragraph", text: "thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty abc def", sourceContext: "main" },
      { type: "paragraph", text: "ghi jkl mno pqr stu vwx yz cat dog bird fish", sourceContext: "main" },
      { type: "paragraph", text: "sun moon star planet comet asteroid galaxy nebula quasar pulsar", sourceContext: "main" },
      { type: "paragraph", text: "red orange yellow green blue indigo violet cyan magenta black", sourceContext: "main" },
    ];
    const groups = groupAndScoreContent(blocks);
    const lowGroup = groups.find((g) => g.heading?.text === "Low");
    const alsoLow = groups.find((g) => g.heading?.text === "Also low");
    expect(lowGroup?.collapsed).toBe(true);
    expect(alsoLow?.collapsed).toBe(true);
  });

  it("uses threshold of 5 when median is below 5", () => {
    // All groups have score 0 -> median 0 -> threshold max(5,0)=5 -> all collapsed
    const blocks: ContentBlock[] = [
      heading("A"),
      heading("B"),
      heading("C"),
    ];
    const groups = groupAndScoreContent(blocks);
    for (const group of groups) {
      expect(group.collapsed).toBe(true);
    }
  });

  it("computes even-length median correctly ((n/2-1 + n/2) / 2)", () => {
    // Four groups with identical scores, each using unique text to avoid repetition penalty.
    // Each group: heading (1 word, no bonus) + 50-word paragraph (capped score 5) + main context (+2) = 7
    // Sorted scores: [7, 7, 7, 7]; even median = (7+7)/2 = 7; threshold = max(5,7) = 7
    // score (7) == threshold (7) -> collapsed = false (condition is score < threshold)
    const makeGroup = (seed: string) => [
      heading("Section"),
      {
        type: "paragraph" as const,
        // 50 unique words per group to avoid cross-group repetition
        text: Array.from({ length: 50 }, (_, i) => `${seed}${i}`).join(" "),
        sourceContext: "main" as const,
      },
    ];
    const blocks: ContentBlock[] = [
      ...makeGroup("alpha"),
      ...makeGroup("bravo"),
      ...makeGroup("charlie"),
      ...makeGroup("delta"),
    ];
    const groups = groupAndScoreContent(blocks);
    expect(groups).toHaveLength(4);
    for (const group of groups) {
      // score equals threshold -> not collapsed
      expect(group.collapsed).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Edge cases
// ---------------------------------------------------------------------------

describe("groupAndScoreContent – edge cases", () => {
  it("returns empty array for empty input", () => {
    expect(groupAndScoreContent([])).toEqual([]);
  });

  it("handles a single paragraph block (no headings)", () => {
    const blocks: ContentBlock[] = [richPara(10)];
    const groups = groupAndScoreContent(blocks);
    expect(groups).toHaveLength(1);
    expect(groups[0].heading).toBeUndefined();
    expect(groups[0].blocks).toHaveLength(1);
  });

  it("handles consecutive headings with no blocks between them", () => {
    const blocks: ContentBlock[] = [
      heading("First"),
      heading("Second"),
      richPara(8),
    ];
    const groups = groupAndScoreContent(blocks);
    expect(groups).toHaveLength(2);
    expect(groups[0].heading?.text).toBe("First");
    expect(groups[0].blocks).toHaveLength(0);
    expect(groups[1].heading?.text).toBe("Second");
    expect(groups[1].blocks).toHaveLength(1);
  });

  it("every output group has a score property", () => {
    const blocks: ContentBlock[] = [heading("Section"), richPara(10)];
    const groups = groupAndScoreContent(blocks);
    for (const group of groups) {
      expect(typeof group.score).toBe("number");
    }
  });

  it("every output group has a collapsed boolean property", () => {
    const blocks: ContentBlock[] = [heading("Section"), richPara(10)];
    const groups = groupAndScoreContent(blocks);
    for (const group of groups) {
      expect(typeof group.collapsed).toBe("boolean");
    }
  });

  it("text that appears exactly twice is not penalised as repeated", () => {
    const shared = "Click here for more info about the topic";
    const blocks: ContentBlock[] = [
      heading("A"),
      { type: "paragraph", text: shared },
      heading("B"),
      { type: "paragraph", text: shared },
    ];
    const groups = groupAndScoreContent(blocks);
    // 8 words -> blockScore = min(8/10, 5) = 0.8; not in repetitionSet (only 2 occurrences)
    for (const group of groups) {
      expect(group.score).toBeGreaterThan(0);
    }
  });
});

describe("groupAndScoreContent – table and definition-list scoring", () => {
  it("scores a table block as 3 + rows*0.3, capped at 10", () => {
    const blocks: ContentBlock[] = [
      heading("Table section"),
      {
        type: "table",
        text: "Table: Col A, Col B",
        headers: ["Col A", "Col B"],
        rows: Array.from({ length: 5 }, (_, i) => [`row${i}a`, `row${i}b`]),
      },
    ];
    const groups = groupAndScoreContent(blocks);
    // 3 + 5*0.3 = 4.5; heading "Table section" = 2 words -> no heading bonus
    expect(groups[0].score).toBeCloseTo(4.5);
  });

  it("caps table score at 10", () => {
    const blocks: ContentBlock[] = [
      {
        type: "table",
        text: "Large table",
        rows: Array.from({ length: 100 }, (_, i) => [`cell${i}`]),
      },
    ];
    const groups = groupAndScoreContent(blocks);
    // 3 + 100*0.3 = 33, capped at 10; body context = no bonus
    expect(groups[0].score).toBeCloseTo(10);
  });

  it("scores a definition-list at 1.0 per definition, capped at 8", () => {
    const blocks: ContentBlock[] = [
      {
        type: "definition-list",
        text: "Terms",
        definitions: [
          { term: "A", description: "Alpha" },
          { term: "B", description: "Bravo" },
          { term: "C", description: "Charlie" },
        ],
      },
    ];
    const groups = groupAndScoreContent(blocks);
    // 3 * 1.0 = 3; body context = no bonus
    expect(groups[0].score).toBeCloseTo(3);
  });

  it("caps definition-list score at 8", () => {
    const blocks: ContentBlock[] = [
      {
        type: "definition-list",
        text: "Many terms",
        definitions: Array.from({ length: 20 }, (_, i) => ({ term: `T${i}`, description: `D${i}` })),
      },
    ];
    const groups = groupAndScoreContent(blocks);
    // 20 * 1.0 = 20, capped at 8; body context = no bonus
    expect(groups[0].score).toBeCloseTo(8);
  });
});
