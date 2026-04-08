import type { ArtifactPath, ArtifactPathPattern, ArtifactSelector } from "@/generated/serverTypes";

function encodeArtifactPathComponent(component: string | null | undefined): string {
  return (component ?? "").replace("\\", "\\\\").replace("/", "\\/").replace(":", "\\:").replace("=", "\\=");
}

function decodeArtifactPathComponent(encodedComponent: string): string {
  return encodedComponent.replace("\\=", "=").replace("\\:", ":").replace("\\/", "/").replace("\\\\", "\\");
}

export function encodeArtifactPath(artifactPath: ArtifactPath): string {
  return artifactPath
    .map(({ kind, id }) => {
      if (!kind) return `${encodeArtifactPathComponent(id)}`;
      return `${encodeArtifactPathComponent(kind)}:${encodeArtifactPathComponent(id)}`;
    })
    .join("/");
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

export function decodeArtifactPathPattern(
  encodedStringOrComponents: string | null | undefined | string[],
): ArtifactPathPattern {
  if (!encodedStringOrComponents) return [];

  const artifactPathPattern: ArtifactPathPattern = [];

  let components: string[] = [];
  if (typeof encodedStringOrComponents === "string") {
    components = encodedStringOrComponents ? encodedStringOrComponents.split("/") : [];
  } else {
    components = encodedStringOrComponents;
  }

  for (const component of components) {
    const urlDecodedComponent = decodeURIComponent(component);

    const pathComponentMatcher = urlDecodedComponent.match(/^((.*)\\{0}:)?(.*)$/);
    if (pathComponentMatcher && pathComponentMatcher.length === 4) {
      const kind = pathComponentMatcher[2];
      const id = pathComponentMatcher[3];
      if (kind) {
        if (id) {
          artifactPathPattern.push({ kind, id });
        } else {
          artifactPathPattern.push({ kind });
        }
      } else if (id) {
        artifactPathPattern.push({ id });
      }
    }
  }

  return artifactPathPattern;
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

export function encodeArtifactSelector(artifactPathSelector: ArtifactSelector): string {
  const tagComponents = (artifactPathSelector.tags ?? [])
    .sort((lhs, rhs) => {
      const tagCompareResult = lhs.tag.localeCompare(rhs.tag, "en");
      if (tagCompareResult !== 0) return tagCompareResult;
      return lhs.value.localeCompare(rhs.value, "en", { numeric: true });
    })
    .map(({ tag, value }) => `tag.${encodeArtifactPathComponent(tag)}=${encodeArtifactPathComponent(value)}`);
  const artifactPathComponents = encodeArtifactPath(artifactPathSelector.artifactPath);
  const eventSummaryIDComponents = (artifactPathSelector.eventSummaryIDs ?? [])
    .sort((lhs, rhs) => {
      return lhs.localeCompare(rhs, "en", { numeric: true });
    })
    .map((value) => `eventSummaryID=${encodeArtifactPathComponent(value)}`);
  const recipeRunIDComponents = (artifactPathSelector.recipeRunIDs ?? [])
    .sort((lhs, rhs) => {
      return lhs.localeCompare(rhs, "en", { numeric: true });
    })
    .map((value) => `recipeRunID=${encodeArtifactPathComponent(value)}`);
  const generationIDComponents = (artifactPathSelector.generationIDs ?? [])
    .sort((lhs, rhs) => {
      return lhs.localeCompare(rhs, "en", { numeric: true });
    })
    .map((value) => `generationID=${encodeArtifactPathComponent(value)}`);
  return [
    ...tagComponents,
    artifactPathComponents,
    ...eventSummaryIDComponents,
    ...recipeRunIDComponents,
    ...generationIDComponents,
  ].join("/");
}

export function decodeArtifactSelector(encodedStringOrComponents: string | string[]): ArtifactSelector {
  const artifactPathSelector: ArtifactSelector = { artifactPath: [] };

  let components: string[] = [];
  if (typeof encodedStringOrComponents === "string") {
    components = encodedStringOrComponents ? encodedStringOrComponents.split("/") : [];
  } else {
    components = encodedStringOrComponents;
  }

  for (const component of components) {
    const urlDecodedComponent = decodeURIComponent(component);
    const hasEquals = urlDecodedComponent.match(/^(.*)\\{0}=(.*)$/);
    let key = "id";
    let value = "";
    if (hasEquals && hasEquals.length === 3) {
      key = decodeArtifactPathComponent(hasEquals[1]);
      value = hasEquals[2];
    } else {
      value = urlDecodedComponent;
    }

    const isTag = key.match(/^tag\.(.*)$/);
    if (isTag && isTag.length === 2) {
      const tag = isTag[1];
      if (!artifactPathSelector.tags) artifactPathSelector.tags = [];
      artifactPathSelector.tags.push({ tag, value: decodeArtifactPathComponent(value) });
    } else if (key === "id") {
      const pathComponentMatcher = value.match(/^((.*)\\{0}:)?(.*)$/);
      if (pathComponentMatcher && pathComponentMatcher.length === 4) {
        const kind = pathComponentMatcher[2];
        const id = pathComponentMatcher[3];
        artifactPathSelector.artifactPath.push({ kind: kind ? kind : undefined, id });
      }
    } else if (key === "eventSummaryID") {
      if (!artifactPathSelector.eventSummaryIDs) artifactPathSelector.eventSummaryIDs = [];
      artifactPathSelector.eventSummaryIDs.push(decodeArtifactPathComponent(value));
    } else if (key === "recipeRunID") {
      if (!artifactPathSelector.recipeRunIDs) artifactPathSelector.recipeRunIDs = [];
      artifactPathSelector.recipeRunIDs.push(decodeArtifactPathComponent(value));
    } else if (key === "generationID") {
      if (!artifactPathSelector.generationIDs) artifactPathSelector.generationIDs = [];
      artifactPathSelector.generationIDs.push(decodeArtifactPathComponent(value));
    }
  }

  return artifactPathSelector;
}
