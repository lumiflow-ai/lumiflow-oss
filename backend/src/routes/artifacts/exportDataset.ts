import { z } from "zod";

import type { ArtifactPath, ArtifactPathComponent, ArtifactSnapshot, OrganizationTemplate } from "@/types";

import { withPGClient } from "@/server/persistence";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { csvRow, sanitizeFilename } from "@/lib/csv";
import { Download, DownloadSchema, type RequestContext, RouteGroup } from "@/lib/routeGroup";

import { encodeArtifactPathComponents, matchingPatternsForArtifactPath } from "@/model/artifactPath";

import { ArtifactPathSchema } from "@/definitions/artifactPath";

import { displayNameForArtifactPathPattern } from "../org/configuration/loadOrgConfiguration";
import { OrganizationIDSchema } from "../orgs/definitions";

export const ExportDatasetRequestSchema = z.object({
  orgID: OrganizationIDSchema,
  artifactPath: ArtifactPathSchema,
});

export const exportDataset = new RouteGroup();

exportDataset.get(
  "export",
  {
    requestSchema: ExportDatasetRequestSchema,
    responseSchema: DownloadSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context) => {
    const orgID = request.orgID.toLowerCase();
    const organization = context.user?.organizations.get(orgID);
    if (!organization) {
      throw new AuthorizationError();
    }

    // Fetch dataset name and artifacts from database
    const datasetName = await fetchDatasetName(context, orgID, request.artifactPath);
    const artifacts = await fetchArtifacts(context, orgID, request.artifactPath);

    // Separate into parents (rows) and leaves (columns)
    const { parentArtifacts, contentByParentAndLeaf, leafComponentKeys } = separateParentsAndLeaves(artifacts);

    // Build column headers with display names from org configuration
    const { parentDisplayName, columns } = buildColumnDefinitions(
      parentArtifacts,
      leafComponentKeys,
      contentByParentAndLeaf,
      orgID,
      organization.template,
    );

    // Build CSV rows
    const rows = buildCsvRows(parentArtifacts, parentDisplayName, columns, contentByParentAndLeaf);
    const csvContent = rows.map((row) => csvRow(row)).join("\n");

    // Use dataset name for filename, fall back to id if not available
    let filename = "export";
    if (request.artifactPath.length > 0) {
      if (datasetName) {
        filename = sanitizeFilename(datasetName);
      } else {
        filename = request.artifactPath[request.artifactPath.length - 1]?.id || "export";
      }
    }

    return new Download(csvContent, `${filename}.csv`, "text/csv", "attachment");
  },
);

type LeafContent = {
  content: string;
  leafPath: ArtifactPath;
};

type SeparatedArtifacts = {
  /** Parent artifacts with no content that will become CSV rows */
  parentArtifacts: ArtifactSnapshot[];
  /** Map from parent artifact path to its leaf contents, keyed by leaf path component */
  contentByParentAndLeaf: Map<string, Map<string, LeafContent>>;
  /** Set of all unique leaf component paths (keys) discovered across all parents */
  leafComponentKeys: Set<string>;
};

/**
 * Converts an artifact path or component to a string key for use in Map lookups.
 */
function artifactPathToMapKey(path: ArtifactPath | ArtifactPathComponent): string {
  return JSON.stringify(path);
}

/**
 * Queries the database for the name of the dataset artifact.
 * Returns the name from metadata if found, otherwise returns undefined.
 */
async function fetchDatasetName(
  context: RequestContext,
  orgID: string,
  artifactPath: ArtifactPath,
): Promise<string | undefined> {
  const encodedPath = encodeArtifactPathComponents(artifactPath);
  const pathLength = encodedPath.length;

  const result = await withPGClient(context, async ({ pgClient }) => {
    return await pgClient.query<{ snapshot: ArtifactSnapshot }>({
      text: `
        SELECT snapshot
        FROM public.artifact_snapshots
        WHERE "org_id" = $1
          AND "artifact_path" = $2
          AND array_length("artifact_path", 1) = $3
        LIMIT 1;
      `,
      values: [orgID, encodedPath, pathLength],
    });
  });

  return result.rows[0]?.snapshot.metadata?.name;
}

/**
 * Queries the database for all artifact snapshots that are descendants of the given path.
 * Returns snapshots where artifact_path starts with the given path and has additional components.
 */
async function fetchArtifacts(
  context: RequestContext,
  orgID: string,
  artifactPath: ArtifactPath,
): Promise<ArtifactSnapshot[]> {
  const encodedPath = encodeArtifactPathComponents(artifactPath);
  const pathLength = encodedPath.length;

  context.logger.info("Starting artifact snapshots query for export.");

  const result = await withPGClient(context, async ({ pgClient }) => {
    return await pgClient.query<{ snapshot: ArtifactSnapshot }>({
      text: `
        SELECT snapshot
        FROM public.artifact_snapshots
        WHERE "org_id" = $1
          AND "artifact_path"[1:$2] = $3
          AND array_length("artifact_path", 1) > $2
        LIMIT 5000;
      `,
      values: [orgID, pathLength, encodedPath],
    });
  });

  context.logger.info("Finished artifact snapshots query for export.");
  return result.rows.map((row) => row.snapshot);
}

/**
 * Separates artifacts into parents (artifacts without content) and leaves (artifacts with content).
 * Builds a map from parent path → leaf path component → leaf content for lookup during CSV generation.
 * Deduplicates parent artifacts by path, keeping the most recent snapshot based on timestamp.
 */
function separateParentsAndLeaves(artifacts: ArtifactSnapshot[]): SeparatedArtifacts {
  const parentArtifactsByPath = new Map<string, ArtifactSnapshot>();
  const contentByParentAndLeaf = new Map<string, Map<string, LeafContent>>();
  const leafComponentKeys = new Set<string>();

  for (const artifact of artifacts) {
    if (artifact.content != null && artifact.artifactPath) {
      // This is a leaf node (has content) - should become a column
      const pathLength = artifact.artifactPath.length;
      const parentPathKey = artifactPathToMapKey(artifact.artifactPath.slice(0, pathLength - 1));
      const lastComponent = artifact.artifactPath[pathLength - 1];
      const leafComponentKey = artifactPathToMapKey(lastComponent);

      leafComponentKeys.add(leafComponentKey);

      if (!contentByParentAndLeaf.has(parentPathKey)) {
        contentByParentAndLeaf.set(parentPathKey, new Map());
      }
      contentByParentAndLeaf.get(parentPathKey)?.set(leafComponentKey, {
        content: artifact.content as string,
        leafPath: artifact.artifactPath,
      });
    } else if (artifact.artifactPath) {
      // This is a parent artifact (no content) - should become a row
      // Deduplicate by path, keeping the most recent (latest timestamp)
      const pathKey = artifactPathToMapKey(artifact.artifactPath);
      const existing = parentArtifactsByPath.get(pathKey);

      if (!existing || (artifact.timestamp && existing.timestamp && artifact.timestamp > existing.timestamp)) {
        parentArtifactsByPath.set(pathKey, artifact);
      }
    }
  }

  // Convert map to array for processing
  const parentArtifacts = Array.from(parentArtifactsByPath.values());

  return { parentArtifacts, contentByParentAndLeaf, leafComponentKeys };
}

/**
 * Resolves the human-readable display name for an artifact path.
 * Converts the path to a pattern and looks up the configured display name for the organization.
 */
function getDisplayNameForArtifactPath(
  orgID: string,
  organizationTemplate: OrganizationTemplate | undefined,
  artifactPath: ArtifactPath,
) {
  const pattern = matchingPatternsForArtifactPath(artifactPath).at(-1);
  if (!pattern) {
    throw new Error("matchingPatternsForArtifactPath returned empty array");
  }
  return displayNameForArtifactPathPattern({
    orgID,
    artifactPathPattern: pattern,
    organizationTemplate,
  }).one;
}

/**
 * Builds CSV column definitions including the parent column name and all leaf columns.
 * Looks up display names from organization configuration for each discovered artifact type.
 */
function buildColumnDefinitions(
  parentArtifacts: ArtifactSnapshot[],
  leafComponentKeys: Set<string>,
  contentByParentAndLeaf: Map<string, Map<string, LeafContent>>,
  orgID: string,
  organizationTemplate: OrganizationTemplate | undefined,
) {
  // Get display name for parent artifact column
  let parentDisplayName = "Artifact";
  if (parentArtifacts.length > 0 && parentArtifacts[0].artifactPath) {
    const parentPath = parentArtifacts[0].artifactPath;
    parentDisplayName = getDisplayNameForArtifactPath(orgID, organizationTemplate, parentPath);
  }

  // Build column definitions for each discovered leaf type
  const columns: Array<{ leafComponentKey: string; displayName: string }> = [];

  for (const leafComponentKey of leafComponentKeys) {
    // Find any leaf with this component to get its full path
    let leafPath: ArtifactPath | undefined;
    for (const leafMap of contentByParentAndLeaf.values()) {
      const leaf = leafMap.get(leafComponentKey);
      if (leaf) {
        leafPath = leaf.leafPath;
        break;
      }
    }

    if (leafPath) {
      const displayName = getDisplayNameForArtifactPath(orgID, organizationTemplate, leafPath);
      columns.push({ leafComponentKey, displayName });
    }
  }

  return { parentDisplayName, columns };
}

/**
 * Builds CSV rows as 2D string arrays, starting with a header row followed by data rows.
 * Each data row contains the parent name, content for each leaf column, and timestamp.
 */
function buildCsvRows(
  parentArtifacts: ArtifactSnapshot[],
  parentDisplayName: string,
  columns: Array<{ leafComponentKey: string; displayName: string }>,
  contentByParentAndLeaf: Map<string, Map<string, LeafContent>>,
) {
  const rows: string[][] = [];
  rows.push([parentDisplayName, ...columns.map((col) => col.displayName), "Date"]);

  for (const artifact of parentArtifacts) {
    const name =
      artifact.metadata?.name ||
      (artifact.artifactPath && artifact.artifactPath.length > 0
        ? artifact.artifactPath[artifact.artifactPath.length - 1]?.id
        : "") ||
      "";

    const parentPathKey = artifact.artifactPath ? artifactPathToMapKey(artifact.artifactPath) : "";
    const leafContentMap = contentByParentAndLeaf.get(parentPathKey);
    const leafContents = columns.map((col) => leafContentMap?.get(col.leafComponentKey)?.content ?? "");
    const timestamp = artifact.timestamp ?? "";

    rows.push([name, ...leafContents, timestamp]);
  }

  return rows;
}
