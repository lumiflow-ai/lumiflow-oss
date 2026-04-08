import { describe, expect, it } from "vitest";

import type { Artifact } from "@/generated/serverTypes";

import { __visibleForTesting } from "./artifacts";

const { replaceArtifactInList } = __visibleForTesting;

function createArtifact(id: string, content = "default"): Artifact {
  return {
    artifactPath: [{ kind: "test", id }],
    snapshots: [{ content: { text: content } }],
  };
}

describe("replaceArtifactInList", () => {
  it("replaces artifact with matching path", () => {
    const original = createArtifact("a1");
    const updated = createArtifact("a1", "updated");
    const other = createArtifact("a2");

    const result = replaceArtifactInList([original, other], updated);

    expect(result[0]).toBe(updated);
    expect(result[1]).toBe(other);
  });

  it("returns unchanged list when no path matches", () => {
    const existing = createArtifact("a1");
    const unrelated = createArtifact("a2");

    const result = replaceArtifactInList([existing], unrelated);

    expect(result).toEqual([existing]);
  });
});
