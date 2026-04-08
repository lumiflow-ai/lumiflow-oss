import { isArray } from "lodash";
import { createElement, useCallback, useMemo } from "react";

import { usePagedMetricDefinitions } from "@/generated/serverEndpoints";
import {
  type CSSColor,
  type EvaluationGroupID,
  type KeyPath,
  type Metric,
  type MetricDefinition,
  type MetricID,
  type MetricRecording,
  MetricValueAggregationRule,
  type OrganizationID,
  type PrimitiveValue,
} from "@/generated/serverTypes";

import { encodeArtifactPath } from "@/model/artifactPath";
import { KeyPathValue, popFirstKeyPathComponent, valueForKeyPath } from "@/model/keyPath";

import { Color, StatusIcon } from "@/components/ui";

type StatusIconName = "check" | "dash" | "warning";

export function statusIconNameForValue(value: PrimitiveValue): StatusIconName | null {
  if (value === true) return "check";
  if (value === false) return "dash";
  if (value === "mixed") return "warning";
  return null;
}

export const StandardMetricColors: CSSColor[] = (() => {
  const colors: CSSColor[] = [];
  const steps = 20;
  for (let index = 0; index < steps; index += 1) {
    colors.push(
      `oklch(${index >= (steps / 2) ? "0.85 0.13" : "0.95 0.09"} ${(30 + (index * 360) / (steps / 2)) % 360})`,
    );
  }
  return colors;
})();

export const AnnotationHighlightColor: CSSColor = Color.annotationHighlight;

/// Modified from https://stackoverflow.com/a/7616484
function normalizedHash(string: string) {
  let hash = 0;
  if (string.length === 0) return hash;
  for (let index = 0; index < string.length; index++) {
    const character = string.charCodeAt(index);
    hash = (hash << 5) - hash + character;
    hash |= 0; // Convert to 32bit integer
  }
  return (hash + 2147483647) / 4294967296;
}

function metricColorForID({
  id,
  metricDefinitionForID,
}: {
  id: MetricID;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
}): CSSColor {
  return (
    metricDefinitionForID(id)?.color ??
    StandardMetricColors[Math.round(normalizedHash(id) * StandardMetricColors.length) % StandardMetricColors.length]
  );
}

function aggregateMetricValues({
  values,
  rule,
  evaluationGroupID,
}: {
  values: MetricRecording[];
  rule: MetricValueAggregationRule | undefined;
  evaluationGroupID?: EvaluationGroupID;
}): PrimitiveValue | PrimitiveValue[] {
  const filteredValues = evaluationGroupID ? values.filter((v) => v.evaluationGroupID === evaluationGroupID) : values;
  switch (rule) {
    case MetricValueAggregationRule.uniqueValues: {
      /// Only use metrics with a single unique value.
      if (filteredValues.length !== 1) return null;
      return filteredValues[0].value;
    }
    case MetricValueAggregationRule.anyTrue: {
      /// Use `true` if any value is `true`, `false` otherwise.
      if (filteredValues.length === 0) return null;
      return filteredValues.every(({ value }) => value === true);
    }
    case MetricValueAggregationRule.allTrue: {
      /// Use `true` if all values are `true`, `false` otherwise.
      if (filteredValues.length === 0) return null;
      return filteredValues.every(({ value }) => value === true);
    }
    case MetricValueAggregationRule.concatenate: {
      /// Concatenate values into a string.
      if (filteredValues.length === 0) return null;
      return filteredValues.map(({ value }) => value);
    }
    case MetricValueAggregationRule.uniformValues: {
      const firstValue = filteredValues[0]?.value;
      if (firstValue === null) return null;
      if (filteredValues.every(({ value }) => value === firstValue)) return firstValue;
      return "mixed";
    }
    default: {
      /// Use the last available metric value, with the entire key path as we couldn't handle the next path component.
      return filteredValues.at(-1)?.value ?? null;
    }
  }
}

export function valueForMetricKeyPath({
  metric,
  metricDefinitionForID,
  keyPath = "",
  evaluationGroupID,
}: {
  metric: Metric | null;
  metricDefinitionForID?: (id: MetricID) => MetricDefinition | null;
  keyPath?: KeyPath;
  evaluationGroupID?: EvaluationGroupID;
}): KeyPathValue {
  if (!metric) return KeyPathValue(null);
  const metricDefinition = metricDefinitionForID?.(metric.id) ?? null;
  const metricValueAggregationRule = metricDefinition?.metricValueAggregationRule;

  const [validatedValues, remainingPath] = (() => {
    const [component, remainingPath] = popFirstKeyPathComponent(keyPath);
    switch (component) {
      case "":
        /// Use the metric definition's preferred aggregation rule.
        return [
          aggregateMetricValues({ values: metric.values, rule: metricValueAggregationRule, evaluationGroupID }),
          remainingPath,
        ];
      case MetricValueAggregationRule.uniqueValues:
      case MetricValueAggregationRule.anyTrue:
      case MetricValueAggregationRule.allTrue:
      case MetricValueAggregationRule.concatenate:
      case MetricValueAggregationRule.uniformValues:
        /// We are parsing a known aggregation rule, so override with that path component.
        return [aggregateMetricValues({ values: metric.values, rule: component, evaluationGroupID }), remainingPath];
      default: {
        /// Use the metric definition's preferred aggregation rule, with the entire key path as we couldn't handle the proposed path component here.
        return [
          aggregateMetricValues({ values: metric.values, rule: metricValueAggregationRule, evaluationGroupID }),
          keyPath,
        ];
      }
    }
  })();

  const rawBaseValue = (() => {
    if (!isArray(validatedValues)) return validatedValues;
    return validatedValues.map((value) => `${value}`).join(",");
  })();

  const formattedValue = (() => {
    if (!isArray(validatedValues)) return formattedValueForMetricValue({ value: validatedValues, metricDefinition });
    return validatedValues.map((value) => `${formattedValueForMetricValue({ value, metricDefinition })}`).join(", ");
  })();

  const displayValue = (() => {
    /// If the value is not compatible with icon rendering, return it as is.
    if (
      remainingPath ||
      isArray(validatedValues) ||
      !(metricDefinition?.kind === "icon" && metricDefinition.unit === "status")
    ) {
      return `${valueForKeyPath(formattedValue, remainingPath).display ?? "None"}`;
    }

    /// Otherwise, create an icon component for it. Note we aren't in a JSX file, so create the node manually.
    return createElement(StatusIcon, { icon: formattedValue as StatusIcon }, null);
  })();

  return KeyPathValue({
    ...valueForKeyPath(rawBaseValue, remainingPath),
    display: displayValue,
  });
}

function formattedValueForMetricValue({
  value,
  metricDefinition,
}: {
  value: PrimitiveValue;
  metricDefinition: MetricDefinition | null;
}): string | null {
  const rawValue = value;
  if (rawValue == null) return null;

  /// If a display value exists, use it:
  const matchingDisplayValue = metricDefinition?.displayValues?.find(([key, _]) => key === rawValue)?.[1];
  if (matchingDisplayValue !== undefined) return matchingDisplayValue;

  if (metricDefinition?.kind === "icon" && metricDefinition?.unit === "status") {
    const iconName = statusIconNameForValue(rawValue);
    if (iconName) return iconName;
  }

  /// Otherwise fall back to parsing by unit, if available:
  if (!metricDefinition?.unit) return `${rawValue}`;
  switch (metricDefinition.unit) {
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: Doesn't actually fall through.
    case "percentage":
      switch (typeof rawValue) {
        case "number":
          return `${Math.round(rawValue * 100)}%`;
        case "string":
          return `${rawValue}%`;
        case "boolean":
          return `${rawValue ? "100" : "0"}%`;
      }
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: Doesn't actually fall through.
    case "notdetected":
      switch (typeof rawValue) {
        case "boolean":
          return rawValue ? "" : "⚠️";
        case "string":
        case "number":
          return rawValue ? `${rawValue}` : "⚠️";
      }
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: Doesn't actually fall through.
    case "detected":
      switch (typeof rawValue) {
        case "boolean":
          return rawValue ? "⚠️" : "";
        case "string":
        case "number":
          return rawValue ? `⚠️ (${rawValue})` : "";
      }
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: Doesn't actually fall through.
    case "found":
      switch (typeof rawValue) {
        case "boolean":
          return rawValue ? "✔️" : "❌";
        case "string":
        case "number":
          return rawValue ? `✔️ (${rawValue})` : "❌";
      }
    default:
      break;
  }
  return `${rawValue}`;
}

export function useMetricDefinitions(orgID: OrganizationID | undefined): {
  metricDefinitions: Map<MetricID, MetricDefinition> | undefined;
  error: Error | undefined;
  isLoading: boolean;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
  refreshMetrics: () => Promise<void>;
  metricColorForID: (id: MetricID) => CSSColor;
} {
  const { response, error, isLoading, refresh } = usePagedMetricDefinitions(orgID ? { orgID } : undefined);

  const metricDefinitions = useMemo(() => {
    if (!response?.metricDefinitions) return undefined;
    return new Map(response.metricDefinitions.map((definition) => [definition.id, definition]));
  }, [response]);

  const metricDefinitionForID = useCallback(
    (id: MetricID) => metricDefinitions?.get(id.toLowerCase()) ?? null,
    [metricDefinitions],
  );

  const _metricColorForID = useCallback(
    (id: MetricID) => metricColorForID({ id, metricDefinitionForID }),
    [metricDefinitionForID],
  );

  const refreshMetrics = useCallback(async () => {
    await refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      error,
      isLoading,
      metricDefinitions,
      metricDefinitionForID,
      refreshMetrics,
      metricColorForID: _metricColorForID,
    }),
    [error, isLoading, metricDefinitions, metricDefinitionForID, refreshMetrics, _metricColorForID],
  );
}

export function encodedArtifactPathsForMetricExamples(metrics: IterableIterator<Metric> | Metric[]): Set<string> {
  const encodedArtifactPaths = new Set<string>();

  for (const metric of metrics) {
    const examples = metric.values.flatMap((recording) => recording.examples ?? []);
    for (const example of examples) {
      encodedArtifactPaths.add(encodeArtifactPath(example.artifactPath));
    }
  }

  return encodedArtifactPaths;
}
