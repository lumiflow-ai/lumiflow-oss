import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { fetchCreateArtifact, fetchCreateSnapshots } from "@/generated/serverEndpoints";
import type { ArtifactPathPattern, OrganizationID } from "@/generated/serverTypes";

import { decodeArtifactSelector, encodeArtifactSelector } from "@/model/artifactPath";

import type { KindConfigurationLookup } from "@/components/contexts/OrganizationContext";
import type { CSVColumnDefinition } from "@/components/modals/UploadCSVModal";

import { invalidateContentArtifacts } from "@/app/navigator/_shared/artifacts";

import { requiredValueValidator, timestampISOValueValidator } from "./csvUpload";

export function getArtifactCSVColumnDefinitions({
  kindConfigurationForPattern,
  genericArtifactName,
}: {
  kindConfigurationForPattern: KindConfigurationLookup;
  genericArtifactName: { one?: string; other?: string; many?: string };
}): CSVColumnDefinition[] {
  const datasetPattern: ArtifactPathPattern = [{ kind: "dataset" }];
  const artifactPattern: ArtifactPathPattern = [...datasetPattern, { kind: "artifact" }];
  const inputPattern: ArtifactPathPattern = [...artifactPattern, { id: "input" }];
  const outputPattern: ArtifactPathPattern = [...artifactPattern, { id: "output" }];
  const artifactKindDisplayName = kindConfigurationForPattern(artifactPattern, "one").otherNames;
  const inputKindDisplayName = kindConfigurationForPattern(inputPattern, "one").otherNames;
  const outputKindDisplayName = kindConfigurationForPattern(outputPattern, "one").otherNames;
  const artifactDisplayName = artifactKindDisplayName.one || genericArtifactName.one || "Artifact";
  const inputDisplayName = inputKindDisplayName.one || "Input";
  const outputDisplayName = outputKindDisplayName.one || "Expected";

  return [
    { title: `${artifactDisplayName}`, description: "Name", validators: [requiredValueValidator] },
    { title: inputDisplayName, description: "Data", validators: [requiredValueValidator] },
    { title: outputDisplayName, description: "Data", validators: [requiredValueValidator] },
    {
      title: "Date",
      description: "MM/DD/YYYY",
      validators: [requiredValueValidator, timestampISOValueValidator],
    },
  ];
}

export function createArtifactUploadHandler({
  organizationID,
  organizationSlug,
  datasetPath,
  datasetName,
  columnDefinitions,
  router,
}: {
  organizationID: OrganizationID | undefined;
  organizationSlug: string | null;
  datasetPath?: string;
  datasetName?: string;
  columnDefinitions: readonly CSVColumnDefinition[];
  router: AppRouterInstance;
}) {
  return async ({ parsed }: { parsed: readonly (Readonly<Record<string, unknown>> | null)[] }): Promise<void> => {
    if (!organizationID) return;

    let finalDatasetPath = datasetPath;

    // If dataset name is provided, create the dataset first
    if (datasetName && !datasetPath) {
      const artifactPath = [{ kind: "dataset", id: crypto.randomUUID() }];
      await fetchCreateSnapshots({
        orgID: organizationID,
        snapshots: [
          {
            artifactPath,
            sourceArtifactSelectors: [],
            eventSummaryID: crypto.randomUUID(),
            tags: {},
            metadata: { name: datasetName },
            metrics: [],
            generations: [],
            timestamp: new Date().toISOString(),
            content: null,
            annotations: {},
            reviews: {},
            dueDates: {},
          },
        ],
      });
      await invalidateContentArtifacts(organizationID);
      finalDatasetPath = encodeArtifactSelector({
        tags: [],
        artifactPath,
        eventSummaryIDs: [],
        generationIDs: [],
      });
    }

    if (!finalDatasetPath) {
      console.error("No dataset path available for upload");
      return;
    }

    const parentArtifactPath = decodeArtifactSelector(finalDatasetPath).artifactPath;
    const [nameColumn, inputColumn, outputColumn, timestampColumn] = columnDefinitions.map(({ title }) => title);

    const rowsToUpload = parsed.reduce<Array<{ name?: string; input: string; output: string; timestamp: string }>>(
      (rows, row) => {
        if (!row) return rows;
        rows.push({
          name: row[nameColumn] as string,
          input: row[inputColumn] as string,
          output: row[outputColumn] as string,
          timestamp: row[timestampColumn] as string,
        });
        return rows;
      },
      [],
    );

    try {
      const results = await Promise.all(
        rowsToUpload.map((row) => {
          try {
            const metadata = row.name ? { name: row.name } : undefined;
            return fetchCreateArtifact({
              orgID: organizationID,
              parentArtifactPath,
              id: crypto.randomUUID().toLowerCase(),
              timestamp: row.timestamp,
              input: row.input,
              output: row.output,
              ...(metadata ? { metadata } : {}),
            });
          } catch (error) {
            return { error: `Failed to upload artifact: ${(error as Error).message}` };
          }
        }),
      );

      for (const result of results) {
        if ("error" in result) {
          console.error("CSV import backend errors:", result.error);
        }
      }

      await invalidateContentArtifacts(organizationID);
      if (organizationSlug) {
        router.push(`/app/${organizationSlug}/artifacts/${finalDatasetPath}`);
      }
    } catch (error) {
      console.error("Failed to upload artifacts", error);
    }
  };
}
