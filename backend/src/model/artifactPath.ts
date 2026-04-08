import type { ArtifactPath, ArtifactPathPattern } from "@/types";

function encodeArtifactPathComponent(component: string | null | undefined): string {
  return (component ?? "").replace("\\", "\\\\").replace("/", "\\/").replace(":", "\\:").replace("=", "\\=");
}

export function encodeArtifactPath(artifactPath: ArtifactPath): string {
  return artifactPath
    .map(({ kind, id }) => {
      if (!kind) return `${encodeArtifactPathComponent(id)}`;
      return `${encodeArtifactPathComponent(kind)}:${encodeArtifactPathComponent(id)}`;
    })
    .join("/");
}

export function encodeArtifactPathComponents(artifactPath: ArtifactPath): string[][] {
  return artifactPath.map(({ kind, id }) => [kind ?? "", id]);
}

export function encodeArtifactPathPattern(artifactPath: ArtifactPathPattern): string {
  return artifactPath
    .map((component) => {
      if ("kind" in component && component.id) {
        return `${encodeArtifactPathComponent(component.kind)}:${encodeArtifactPathComponent(component.id)}`;
      }
      if ("kind" in component) return `${encodeArtifactPathComponent(component.kind)}:`;
      return `${encodeArtifactPathComponent(component.id)}`;
    })
    .join("/");
}

export function matchingPatternsForArtifactPath(
  artifactPath: ArtifactPathPattern | ArtifactPath,
): ArtifactPathPattern[] {
  const patterns: ArtifactPathPattern[] = [];
  const parentPattern: ArtifactPathPattern = [];
  patterns.push(Array.from(artifactPath));
  for (const [index, component] of artifactPath.entries()) {
    if ("kind" in component && component.kind) {
      parentPattern.push({ kind: component.kind });
    } else if (component.id) {
      parentPattern.push({ id: component.id });
    }
    const remainingPath = artifactPath.slice(index + 1);
    patterns.push(parentPattern.concat(remainingPath));
  }
  return patterns;
}

export function artifactPathMatchesPattern(
  artifactPath: ArtifactPath,
  artifactPathPattern: ArtifactPathPattern,
): boolean {
  if (artifactPathPattern.length === 0) return true;
  if (artifactPath.length < artifactPathPattern.length) return false;

  for (let index = 0; index < artifactPathPattern.length; index += 1) {
    const patternComponent = artifactPathPattern[index];
    const artifactComponent = artifactPath[index];

    if ("kind" in patternComponent) {
      if (patternComponent.kind && artifactComponent.kind !== patternComponent.kind) {
        return false;
      }
      if ("id" in patternComponent && patternComponent.id && artifactComponent.id !== patternComponent.id) {
        return false;
      }
    } else if (artifactComponent.id !== patternComponent.id) {
      return false;
    }
  }
  return true;
}
