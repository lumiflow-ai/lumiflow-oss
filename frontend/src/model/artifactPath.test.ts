import { describe, expect, it } from "vitest";

import { artifactPathMatchesPattern, decodeArtifactPathPattern, encodeArtifactPath } from "@/model/artifactPath";

describe("artifactPath", () => {
  it("should encode a simple artifact path", () => {
    const artifactPath = [
      { kind: "project", id: "my-app" },
      { kind: "version", id: "v1.0.0" },
    ];

    const encoded = encodeArtifactPath(artifactPath);

    expect(encoded).toBe("project:my-app/version:v1.0.0");
  });

  it("should decode a simple artifact path", () => {
    const encodedPath = "project:my-app/version:v1.0.0";

    const decoded = decodeArtifactPathPattern(encodedPath);

    expect(decoded).toEqual([
      { kind: "project", id: "my-app" },
      { kind: "version", id: "v1.0.0" },
    ]);
  });

  describe("artifactPathMatchesPattern", () => {
    const artifactPath = [
      { kind: "dataset", id: "dataset-1" },
      { kind: "artifact", id: "artifact-1" },
      { kind: "output", id: "output-1" },
    ];

    it("matches prefix patterns", () => {
      expect(
        artifactPathMatchesPattern(artifactPath, [
          { kind: "dataset", id: "dataset-1" },
          { kind: "artifact", id: "artifact-1" },
        ]),
      ).toBe(true);
    });

    it("matches kind-only wildcard patterns", () => {
      expect(artifactPathMatchesPattern(artifactPath, [{ kind: "dataset" }, { kind: "artifact" }])).toBe(true);
    });

    it("matches id-only patterns", () => {
      expect(artifactPathMatchesPattern(artifactPath, [{ id: "dataset-1" }, { id: "artifact-1" }])).toBe(true);
    });

    it("returns false for mismatched kind", () => {
      expect(
        artifactPathMatchesPattern(artifactPath, [{ kind: "dataset", id: "dataset-1" }, { kind: "document" }]),
      ).toBe(false);
    });

    it("returns false for mismatched id", () => {
      expect(
        artifactPathMatchesPattern(artifactPath, [{ kind: "dataset", id: "dataset-2" }, { kind: "artifact" }]),
      ).toBe(false);
    });

    it("returns false when pattern is longer than artifact path", () => {
      expect(
        artifactPathMatchesPattern(artifactPath, [
          { kind: "dataset", id: "dataset-1" },
          { kind: "artifact", id: "artifact-1" },
          { kind: "output", id: "output-1" },
          { kind: "extra", id: "extra-1" },
        ]),
      ).toBe(false);
    });
  });
});
