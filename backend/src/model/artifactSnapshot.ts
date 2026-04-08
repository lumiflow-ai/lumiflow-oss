import type { ArtifactSnapshot, ArtifactSnapshotStrict, MetricRecordingStrict, MetricStrict } from "@/types";

/** Merges an updated snapshot into an existing one, combining metrics and generations. */
export function mergeSnapshots({
  existingSnapshot,
  updatedSnapshot,
  now,
}: {
  existingSnapshot: ArtifactSnapshotStrict;
  updatedSnapshot:
    | Partial<ArtifactSnapshotStrict>
    | (ArtifactSnapshot & Pick<ArtifactSnapshotStrict, "eventSummaryID">);
  /** Used for annotation timestamps. Defaults to current time if not provided. */
  now?: Date;
}): ArtifactSnapshotStrict {
  const effectiveNow = now ?? new Date();
  const { artifactPath, eventSummaryID } = existingSnapshot;
  const encounteredGenerationIDs = new Set<string>();

  /// Merge metrics individually, then re-order them by metric ID, and each metric value by event summary ID then generation ID.
  const metricsMap = new Map(
    existingSnapshot.metrics.flatMap((metric) => {
      const filteredValues: MetricRecordingStrict[] = [];
      for (const value of metric.values) {
        if (value.eventSummaryID !== eventSummaryID) continue;
        filteredValues.push(value);
        encounteredGenerationIDs.add(value.generationID ?? "");
      }

      if (filteredValues.length === 0) return [];
      if (!metric.id) {
        console.log("Metric in existing artifact is missing id.");
        metric.id = "";
      }
      return [
        [
          metric.id,
          {
            ...metric,
            values: filteredValues,
          },
        ],
      ];
    }),
  );
  for (const updatedMetric of updatedSnapshot.metrics ?? []) {
    if (!updatedMetric.id) {
      console.log("Metric in new artifact is missing id.");
      updatedMetric.id = existingSnapshot.eventSummaryID;
    }
    const existingMetric = metricsMap.get(updatedMetric.id);
    if (!existingMetric) {
      const filteredValues: MetricRecordingStrict[] = [];
      for (const value of updatedMetric.values) {
        if (value.eventSummaryID !== eventSummaryID) continue;
        filteredValues.push({
          ...value,
          generationID: value.generationID ?? "",
          recipeRunID: value.recipeRunID ?? "",
        });
        encounteredGenerationIDs.add(value.generationID ?? "");
      }

      metricsMap.set(updatedMetric.id, {
        ...(updatedMetric as MetricStrict),
        values: filteredValues,
      });
      continue;
    }

    const values = new Map((existingMetric.values ?? []).map((value) => [value.generationID, value]));
    for (const value of updatedMetric.values) {
      if (value.eventSummaryID !== eventSummaryID) continue;
      values.set(value.generationID ?? "", {
        ...value,
        generationID: value.generationID ?? "",
        recipeRunID: value.recipeRunID ?? "",
      });
      encounteredGenerationIDs.add(value.generationID ?? "");
    }

    existingMetric.values = Array.from(values.values());
  }

  /// Merge generations by generation ID, then re-order them by date.
  const generationsMap = new Map(
    existingSnapshot.generations.flatMap((generation) => {
      if (!generation.generationID) {
        console.log("Generation in existing artifact is missing generationID.");
        generation.generationID = "";
      }
      if (!encounteredGenerationIDs.has(generation.generationID)) return [];
      return [[generation.generationID, generation]];
    }),
  );
  for (const generation of updatedSnapshot.generations ?? []) {
    console.log({ generation }, "Adding generation.");
    if (!generation.generationID) {
      console.log("Generation in new artifact is missing generationID.");
      generation.generationID = "";
    }
    if (!encounteredGenerationIDs.has(generation.generationID)) continue;
    generationsMap.set(generation.generationID, generation);
  }

  /// Sort generations by when they completed.
  const generations = Array.from(generationsMap.values()).sort((lhs, rhs) => {
    const generationIDSort = new Date(lhs.endTimestamp).getTime() - new Date(rhs.endTimestamp).getTime();
    if (generationIDSort !== 0) return generationIDSort;
    return (lhs.generationID ?? "").localeCompare(rhs.generationID ?? "", "en");
  });

  /// Get a stable order we can use for ordering metric values chronologically.
  const generationIDOrdering = new Map(generations.map((generation, index) => [generation.generationID, index]));
  for (const [_, metric] of metricsMap) {
    metric.values.sort((lhs, rhs) => {
      return (
        (generationIDOrdering.get(lhs.generationID ?? "") ?? 0) -
        (generationIDOrdering.get(rhs.generationID ?? "") ?? 0)
      );
    });
  }
  const metrics = Array.from(metricsMap.values()).sort((lhs, rhs) => lhs.id.localeCompare(rhs.id, "en"));

  return {
    artifactPath: artifactPath,
    sourceArtifactSelectors: updatedSnapshot.sourceArtifactSelectors ?? existingSnapshot.sourceArtifactSelectors,
    eventSummaryID: eventSummaryID,
    tags: updatedSnapshot.tags ?? existingSnapshot.tags,
    metadata: updatedSnapshot.metadata ?? existingSnapshot.metadata,
    timestamp: updatedSnapshot.timestamp ?? existingSnapshot.timestamp,
    // Preserve explicit `null` content updates while keeping existing content when field is omitted.
    content: "content" in updatedSnapshot ? (updatedSnapshot.content ?? null) : existingSnapshot.content,
    metrics,
    generations,
    annotations: mergeTimestampedRecords(
      existingSnapshot.annotations,
      updatedSnapshot.annotations ?? {},
      effectiveNow,
      "content",
    ),
    reviews: mergeTimestampedRecords(existingSnapshot.reviews, updatedSnapshot.reviews ?? {}, effectiveNow, "value"),
    dueDates: { ...existingSnapshot.dueDates, ...updatedSnapshot.dueDates },
  };
}

/**
 * Merges records with timestamp tracking. Updated entries win.
 * If an existing entry has `isDeleted: true`, it cannot be resurrected.
 */
export function mergeTimestampedRecords<
  T extends { createdTimestamp: string; modifiedTimestamp: string },
  K extends keyof T,
>(existing: Record<string, T>, updated: Record<string, T>, now: Date, valueKey: K): Record<string, T> {
  const nowAsISO = now.toISOString();
  const result: Record<string, T> = { ...existing };

  for (const [id, updatedEntry] of Object.entries(updated)) {
    const existingEntry = result[id];

    if (existingEntry && "isDeleted" in existingEntry && existingEntry.isDeleted) continue;

    const isNew = !existingEntry;
    const valueChanged = isNew || existingEntry[valueKey] !== updatedEntry[valueKey];

    result[id] = {
      ...updatedEntry,
      createdTimestamp: isNew ? nowAsISO : existingEntry.createdTimestamp,
      modifiedTimestamp: valueChanged ? nowAsISO : existingEntry.modifiedTimestamp,
    };
  }

  return result;
}
