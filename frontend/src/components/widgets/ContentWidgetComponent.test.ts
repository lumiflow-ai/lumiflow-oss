import { describe, expect, test } from "vitest";

import type { Annotation, Metric } from "@/generated/serverTypes";

import { splitContent, splitContentByPosition } from "./ContentWidgetComponent";

/** Creates a minimal ContentRange for testing. */
const createRange = (startIndex: number, endIndex: number, content: string) => ({
  startIndex,
  endIndex,
  content,
  identifiers: [] as string[],
  metrics: new Set<Metric>(),
  annotations: new Set<Annotation>(),
  hasPendingAnnotation: false,
  targetHighlightRef: { current: null },
  targetHoverRef: { current: null },
  targetTextRef: { current: null },
});

describe("splitContentByPosition", () => {
  test("splits in the middle of a single range", () => {
    const contentRanges = [createRange(0, 26, "Lorem ipsum dolor sit amet")];

    const result = splitContentByPosition({ contentRanges, startIndex: 6, endIndex: 11 });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("ipsum");
    expect(result[0].startIndex).toBe(6);
    expect(result[0].endIndex).toBe(11);

    // Original array should be mutated with 3 ranges
    expect(contentRanges).toHaveLength(3);
    expect(contentRanges[0].content).toBe("Lorem ");
    expect(contentRanges[1].content).toBe("ipsum");
    expect(contentRanges[2].content).toBe(" dolor sit amet");
  });

  test("splits at the start of content", () => {
    const contentRanges = [createRange(0, 26, "Lorem ipsum dolor sit amet")];

    const result = splitContentByPosition({ contentRanges, startIndex: 0, endIndex: 5 });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Lorem");
    expect(contentRanges).toHaveLength(2);
    expect(contentRanges[0].content).toBe("Lorem");
    expect(contentRanges[1].content).toBe(" ipsum dolor sit amet");
  });

  test("splits at the end of content", () => {
    const contentRanges = [createRange(0, 26, "Lorem ipsum dolor sit amet")];

    const result = splitContentByPosition({ contentRanges, startIndex: 22, endIndex: 26 });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("amet");
    expect(contentRanges).toHaveLength(2);
    expect(contentRanges[0].content).toBe("Lorem ipsum dolor sit ");
    expect(contentRanges[1].content).toBe("amet");
  });

  test("splits spanning multiple pre-existing ranges", () => {
    const contentRanges = [
      createRange(0, 6, "Lorem "),
      createRange(6, 12, "ipsum "),
      createRange(12, 26, "dolor sit amet"),
    ];

    // Split from middle of "ipsum " to middle of "dolor sit amet"
    const result = splitContentByPosition({ contentRanges, startIndex: 8, endIndex: 17 });

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("sum ");
    expect(result[1].content).toBe("dolor");

    // Should have 5 ranges now: "Lorem ", "ip", "sum ", "dolor", " sit amet"
    expect(contentRanges).toHaveLength(5);
    expect(contentRanges.map((r) => r.content)).toEqual(["Lorem ", "ip", "sum ", "dolor", " sit amet"]);
  });

  test("returns empty array for negative start index", () => {
    const contentRanges = [createRange(0, 26, "Lorem ipsum dolor sit amet")];

    const result = splitContentByPosition({ contentRanges, startIndex: -1, endIndex: 5 });

    expect(result).toEqual([]);
    expect(contentRanges).toHaveLength(1); // Unchanged
  });

  test("returns empty array when end <= start", () => {
    const contentRanges = [createRange(0, 26, "Lorem ipsum dolor sit amet")];

    expect(splitContentByPosition({ contentRanges, startIndex: 10, endIndex: 10 })).toEqual([]);
    expect(splitContentByPosition({ contentRanges, startIndex: 10, endIndex: 5 })).toEqual([]);
    expect(contentRanges).toHaveLength(1); // Unchanged
  });

  test("returns empty array when position is outside content bounds", () => {
    const contentRanges = [createRange(0, 26, "Lorem ipsum dolor sit amet")];

    const result = splitContentByPosition({ contentRanges, startIndex: 30, endIndex: 40 });

    expect(result).toEqual([]);
    expect(contentRanges).toHaveLength(1); // Unchanged
  });

  test("handles exact match of entire range", () => {
    const contentRanges = [
      createRange(0, 5, "Lorem"),
      createRange(5, 11, " ipsum"),
      createRange(11, 26, " dolor sit amet"),
    ];

    const result = splitContentByPosition({ contentRanges, startIndex: 5, endIndex: 11 });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe(" ipsum");
    expect(contentRanges).toHaveLength(3); // Same count, but middle range is now a copy
  });

  test("sequential non-overlapping splits subdivide ranges correctly", () => {
    const contentRanges = [createRange(0, 26, "Lorem ipsum dolor sit amet")];

    // First annotation at "ipsum" (6-11)
    const first = splitContentByPosition({ contentRanges, startIndex: 6, endIndex: 11 });
    first[0].identifiers.push("annotation-1");

    // Second annotation at "dolor" (12-17) - adjacent but not overlapping
    const second = splitContentByPosition({ contentRanges, startIndex: 12, endIndex: 17 });
    second[0].identifiers.push("annotation-2");

    expect(contentRanges).toHaveLength(5);
    expect(contentRanges.map((r) => r.content)).toEqual(["Lorem ", "ipsum", " ", "dolor", " sit amet"]);
    expect(contentRanges[1].identifiers).toContain("annotation-1");
    expect(contentRanges[3].identifiers).toContain("annotation-2");
  });

  test("overlapping splits share characters in the intersection", () => {
    const contentRanges = [createRange(0, 26, "Lorem ipsum dolor sit amet")];

    // First annotation covers "ipsum dolor" (6-17)
    const first = splitContentByPosition({ contentRanges, startIndex: 6, endIndex: 17 });
    for (const range of first) {
      range.identifiers.push("annotation-1");
    }

    // Second annotation covers "dolor sit" (12-21) - overlaps at "dolor" (12-17)
    const second = splitContentByPosition({ contentRanges, startIndex: 12, endIndex: 21 });
    for (const range of second) {
      range.identifiers.push("annotation-2");
    }

    // "Lorem " | "ipsum " | "dolor" | " sit" | " amet"
    expect(contentRanges).toHaveLength(5);
    expect(contentRanges.map((r) => r.content)).toEqual(["Lorem ", "ipsum ", "dolor", " sit", " amet"]);

    // "ipsum " has only annotation-1
    expect(contentRanges[1].identifiers).toEqual(["annotation-1"]);

    // "dolor" has both annotations (the overlap)
    expect(contentRanges[2].identifiers).toContain("annotation-1");
    expect(contentRanges[2].identifiers).toContain("annotation-2");

    // " sit" has only annotation-2
    expect(contentRanges[3].identifiers).toEqual(["annotation-2"]);
  });

  test("creates independent copies of identifiers and metrics for returned ranges", () => {
    const contentRanges = [createRange(0, 26, "Lorem ipsum dolor sit amet")];
    contentRanges[0].identifiers.push("original");

    const result = splitContentByPosition({ contentRanges, startIndex: 6, endIndex: 11 });

    // Modify the returned range
    result[0].identifiers.push("new-id");

    // The non-matching ranges should still have original reference
    expect(contentRanges[0].identifiers).toContain("original");
    expect(contentRanges[0].identifiers).not.toContain("new-id");
  });
});

describe("splitContent", () => {
  const fullContent = "Lorem ipsum dolor sit amet";

  test("splits when match is in the middle", () => {
    const contentRanges = [createRange(0, 26, fullContent)];

    const result = splitContent({ content: fullContent, contentRanges, matchingContent: "ipsum" });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("ipsum");
    expect(contentRanges).toHaveLength(3);
    expect(contentRanges.map((r) => r.content)).toEqual(["Lorem ", "ipsum", " dolor sit amet"]);
  });

  test("splits when match is at the start", () => {
    const contentRanges = [createRange(0, 26, fullContent)];

    const result = splitContent({ content: fullContent, contentRanges, matchingContent: "Lorem" });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Lorem");
    expect(contentRanges).toHaveLength(2);
  });

  test("splits when match is at the end", () => {
    const contentRanges = [createRange(0, 26, fullContent)];

    const result = splitContent({ content: fullContent, contentRanges, matchingContent: "amet" });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("amet");
    expect(contentRanges).toHaveLength(2);
  });

  test("returns empty array when no match found", () => {
    const contentRanges = [createRange(0, 26, fullContent)];

    const result = splitContent({ content: fullContent, contentRanges, matchingContent: "xyz" });

    expect(result).toEqual([]);
    expect(contentRanges).toHaveLength(1); // Unchanged
  });

  test("returns empty array for empty match string", () => {
    const contentRanges = [createRange(0, 26, fullContent)];

    const result = splitContent({ content: fullContent, contentRanges, matchingContent: "" });

    expect(result).toEqual([]);
    expect(contentRanges).toHaveLength(1); // Unchanged
  });

  test("splits spanning multiple pre-existing ranges", () => {
    const contentRanges = [
      createRange(0, 6, "Lorem "),
      createRange(6, 12, "ipsum "),
      createRange(12, 26, "dolor sit amet"),
    ];

    // Match spans from "ipsum " into "dolor"
    const result = splitContent({ content: fullContent, contentRanges, matchingContent: "ipsum dolor" });

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("ipsum ");
    expect(result[1].content).toBe("dolor");
  });

  test("finds first occurrence when multiple matches exist", () => {
    const content = "foo bar foo baz";
    const contentRanges = [createRange(0, 15, content)];

    const result = splitContent({ content, contentRanges, matchingContent: "foo" });

    expect(result).toHaveLength(1);
    expect(result[0].startIndex).toBe(0); // First occurrence
    expect(result[0].endIndex).toBe(3);
  });
});
