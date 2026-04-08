import type { ArtifactPath } from "@/generated/backendTypes";

function encodeArtifactPathComponent(component: string | null | undefined): string {
  return (component ?? "").replace("\\", "\\\\").replace("/", "\\/").replace(":", "\\:");
}

export function encodeArtifactPath(artifactPath: ArtifactPath, shouldEncodeForURL = false): string {
  return artifactPath
    .map(({ kind, id }) => {
      if (!kind) return encodeArtifactPathComponent(id);
      return `${encodeArtifactPathComponent(kind)}:${encodeArtifactPathComponent(id)}`;
    })
    .map((component) => {
      if (shouldEncodeForURL) return encodeURIComponent(component);
      return component;
    })
    .join("/");
}

export function encodeArtifactPathComponents(artifactPath: ArtifactPath): string[][] {
  return artifactPath.map(({ kind, id }) => [kind ?? "", id]);
}

export function decodeArtifactPathComponents(encodedArtifactPath: string[][]): ArtifactPath {
  return encodedArtifactPath.map(([kind, id]) => (kind ? { kind, id } : { id }));
}
