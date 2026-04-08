import Link from "next/link";
import {
  Fragment,
  type MouseEventHandler,
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled, { css } from "styled-components";

import type {
  Annotation,
  ArtifactPath,
  ArtifactSelector,
  ContentWidget,
  CSSColor,
  Metric,
  MetricDefinition,
  MetricID,
} from "@/generated/serverTypes";

import { type StateObject, useBinding } from "@/library/StateObject";

import type { ArtifactNode } from "@/model/artifactNode";
import { encodeArtifactPath } from "@/model/artifactPath";
import { AnnotationHighlightColor } from "@/model/metrics";

import { type ArtifactAnnotationSelection, isSameArtifact, isSameSnapshot } from "@/components/ArtifactAnnotation";
import type { KindConfigurationLookup } from "@/components/contexts/OrganizationContext";
import { Color, Font, Size } from "@/components/ui";

// MARK: - Constants

// MARK: - Types

type ContentRange = {
  startIndex: number;
  endIndex: number;
  content: string;
  identifiers: string[];
  metrics: Set<Metric>;
  annotations: Set<Annotation>;
  hasPendingAnnotation: boolean;
  targetHighlightRef: MutableRefObject<HTMLSpanElement | null>;
  targetHoverRef: MutableRefObject<HTMLSpanElement | null>;
  targetTextRef: MutableRefObject<HTMLSpanElement | null>;
};

export type ArtifactContextRanges = {
  node: ArtifactNode;
  contentRanges: ContentRange[];
};

export type FormattedArtifactContent = {
  node: ArtifactNode;
  contentRanges: ContentRange[];
  preContext?: ArtifactContextRanges;
  postContext?: ArtifactContextRanges;
  disconnectedContexts?: ArtifactContextRanges[];
};

// MARK: - Styles

const HoverLegendMetric = styled.span`${() => css`
  font-size:${Size.fontSize.fontSize14};
  font-variant: all-small-caps;
  line-height: 1;
  padding: 1px 6px;
  border-radius: 6px;
  text-wrap: nowrap;
  box-shadow: 0 0 0 ${Size.line.thickness} ${Color.line};
`}`;

const HoverLegendContainer = styled.div`${() => css`
  position: relative;
  width: 200px;
  left: -100px;
  top: 6px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  z-index: 200;
  gap: 3px;
`}`;

const HoverLegend = styled.div`${() => css`
  position: absolute;
  width: 0px;
  height: 0px;
`}`;

const Highlight = styled.span`${() => css`
  position: relative;
  padding: 2px 5px;
  border-radius: 6px;
  margin: 0px -5px;
  transition: opacity 0.2s ease-in-out;
`}`;

const FocusGroup = styled.span`${() => css`
  line-height: 1.875;
`}`;

const ContextGroup = styled.span`${() => css`
  opacity: 0.2;
  line-height: 1.25;
  transition: opacity 0.2s ease-in-out;

  &:hover {
    opacity: 0.6;
  }
`}`;

const ArtifactTextLayer = styled.div`${() => css`
  zIndex: 100;
`}`;

const ArtifactHoverLayer = styled.div`${() => css`
  position: absolute;
  left: 10px;
  right: 10px;
  color: transparent;
  -webkit-user-select: none;
  user-select: none;
  pointer-events: none;
`}`;

const ArtifactHighlightLayer = styled.div`${() => css`
  position: absolute;
  left: 10px;
  right: 10px;
  color: transparent;
  -webkit-user-select: none;
  user-select: none;
  pointer-events: none;
  transition: filter 0.2s ease-in-out, opacity 0.2s ease-in-out;
`}`;

const ArtifactContents = styled.div`${() => css`
  position: relative;
  font-family: ${Font.ibmPlexSans};
  font-size: ${Size.fontSize.fontSize14};
  white-space: pre-line;
  overflow-y: auto;
  flex-grow: 1;
  padding: 6px 10px;
  padding-bottom: calc(50cqh - 20px);
  max-width: 900px;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;

  &:has(${Highlight}[data-has-metrics="true"]:hover) ${ArtifactHighlightLayer} {
    filter: saturate(0);
    opacity: 0.75;
  }

  &:has(${Highlight}[data-has-metrics="true"]:hover) ${ArtifactTextLayer} ${Highlight} {
    opacity: 0.5;
  }

  &[data-pinned-highlight="true"] ${ArtifactHighlightLayer} {
    filter: saturate(0);
    opacity: 0.75;
  }

  &[data-pinned-highlight="true"] ${ArtifactTextLayer} ${Highlight} {
    opacity: 0.5;
  }
`}`;

const ArtifactHeader = styled.h2`${() => css`
  display: flex;

  position: absolute;
  left: 0px;
  right: 0px;
  top: 0px;
  align-items: center;
 
  height: 40px;
  margin: 0px;
  padding: 0px 20px;
  background: ${Color.tableHeader};
  flex-shrink: 0;
  box-sizing: content-box;

  font-size: ${Size.fontSize.fontSize14};
  font-family: ${Font.inter};
  font-weight: 500;

  span {
    flex-shrink: 1;
    width: 100%;
    text-overflow: ellipsis;
    hyphens: auto;
    text-wrap: nowrap;
    overflow: hidden;
    color: ${Color.textDark};
    font-weight: 500;

    a {
      color: ${Color.textDark};
      text-decoration: none;

      &:hover {
        color: ${Color.mutedText};
      }
    }

    img {
      width: 6px;
      height: 12px;
      top: 1px !important;
      margin: 0px 6px !important;
    }
  }
`}`;

const ArtifactContainer = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  flex-shrink: 1;
  flex-basis: 100%;
  height: 100%;
  width: 100%;
  color:${Color.textDark};
  padding:40px 10px 0px 10px;
`}`;

const Container = styled.div`${() => css`
  position: absolute;
  display: flex;
  flex-direction: row;
  inset: 0px;
  box-sizing: content-box;
  z-index: 0;
  justify-content: stretch;
  background-color: ${Color.surfaceOffWhiteLight};
  padding-bottom: 10px; 
`}`;

// MARK: - Helper Functions

function renderBackground({
  colors,
  background = "transparent",
  spacing = 4,
}: {
  colors: string[];
  background?: string;
  spacing?: number;
}): string {
  if (colors.length <= 1) return colors[0];

  const count = colors.length;
  const separation = Math.round((10 * spacing) / count) / 10;
  const gradientStops = [...colors, colors[0]].map((color, index) => {
    const start = Math.max(Math.round((100 * (index - 0.4)) / (count + 0.6)), 0);
    const end = Math.min(Math.round((100 * (index + 0.6)) / (count + 0.6)), 100);
    if (index < count) {
      const colorStop = `${color} ${start + separation}% ${end - separation}%`;
      if (spacing) {
        return `${colorStop}, ${background} ${end - separation}% ${end + separation}%`;
      }
      return `${colorStop}`;
    }
    return `${color} ${start + separation}% ${end}%`;
  });

  return `linear-gradient(-45deg, ${gradientStops.join(", ")}) 0px 0px / ${40 * count}px 100%`;
}

/**
 * Perform a binary search on a contiguous series of content ranges.
 */
function findRangeIndex(contentRanges: ContentRange[], startIndex: number): number {
  if (startIndex < 0) return -1; // Not Found

  let leftIndex = 0;
  let rightIndex = contentRanges.length - 1;

  while (leftIndex <= rightIndex) {
    const middleIndex = Math.floor((leftIndex + rightIndex) / 2);

    const contentStartIndex = contentRanges[middleIndex].startIndex;
    const contentEndIndex = contentRanges[middleIndex].endIndex;

    if (startIndex < contentStartIndex) {
      rightIndex = middleIndex - 1; // Search the left half
    } else if (contentEndIndex <= startIndex) {
      leftIndex = middleIndex + 1; // Search the right half
    } else {
      return middleIndex; // We found it
    }
  }

  return -1; // Not Found
}

/**
 * Split content represented by a series of sliced content ranges along the boundaries of a matching string.
 *
 * This method searches `content` for where `matchingContent` first appears, then indexes into the sliced range representation to create new ranges suitable for overlapping highlights. The ranges that would contain the match are returned so they can be annotated accordingly.
 */
export function splitContent({
  content,
  contentRanges,
  matchingContent,
}: {
  content: string;
  contentRanges: ContentRange[];
  matchingContent: string;
}): ContentRange[] {
  /// Get the start and end index of the matching content within the overall content.
  if (matchingContent.length === 0) return [];
  const startIndex = content.indexOf(matchingContent);
  const endIndex = startIndex + matchingContent.length;
  if (startIndex < 0) return [];

  /// Perform a binary search into the pre-existing content ranges to know which existing ranges we'll be slicing up.
  const rangeStartIndex = findRangeIndex(contentRanges, startIndex);
  const rangeEndIndex = findRangeIndex(contentRanges, endIndex - 1); // TODO: Pass rangeStartIndex as the leftIndex here to get a bit more performance.
  if (rangeStartIndex < 0) return [];

  const rangesToReplace = contentRanges.slice(rangeStartIndex, rangeEndIndex + 1);
  const replacementRanges: ContentRange[] = [];
  const matchingRanges: ContentRange[] = [];

  for (const contentRange of rangesToReplace) {
    /// Clamp the start and end indexes to that of the range we are checking.
    const startSplitIndex = Math.max(startIndex, contentRange.startIndex);
    const endSplitIndex = Math.min(endIndex, contentRange.endIndex);

    /// If the clamped ranges perfectly overlap, use the range as is, but make copies of the `identifiers` and `metrics` since the caller will likely modify them.
    if (startSplitIndex === contentRange.startIndex && endSplitIndex === contentRange.endIndex) {
      const newRange: ContentRange = {
        startIndex: contentRange.startIndex,
        endIndex: contentRange.endIndex,
        identifiers: [...contentRange.identifiers],
        metrics: new Set(contentRange.metrics),
        annotations: new Set(contentRange.annotations),
        hasPendingAnnotation: contentRange.hasPendingAnnotation,
        content: contentRange.content,
        targetHighlightRef: { current: null },
        targetHoverRef: { current: null },
        targetTextRef: { current: null },
      };
      replacementRanges.push(newRange);
      matchingRanges.push(newRange);
      continue;
    }

    /// Check if the beginning of the range should be included, otherwise slice it off and don't return it to the caller, but keep it with its old settings.
    if (startSplitIndex !== contentRange.startIndex) {
      replacementRanges.push({
        startIndex: contentRange.startIndex,
        endIndex: startSplitIndex,
        identifiers: contentRange.identifiers,
        metrics: contentRange.metrics,
        annotations: contentRange.annotations,
        hasPendingAnnotation: contentRange.hasPendingAnnotation,
        content: contentRange.content.slice(0, startSplitIndex - contentRange.startIndex),
        targetHighlightRef: { current: null },
        targetHoverRef: { current: null },
        targetTextRef: { current: null },
      });
    }

    /// A sub range was detected so slice the content accordingly, but make copies of the `identifiers` and `metrics` since the caller will likely modify them.
    const newRange: ContentRange = {
      startIndex: startSplitIndex,
      endIndex: endSplitIndex,
      identifiers: [...contentRange.identifiers],
      metrics: new Set(contentRange.metrics),
      annotations: new Set(contentRange.annotations),
      hasPendingAnnotation: contentRange.hasPendingAnnotation,
      content: contentRange.content.slice(
        startSplitIndex - contentRange.startIndex,
        endSplitIndex - contentRange.startIndex,
      ),
      targetHighlightRef: { current: null },
      targetHoverRef: { current: null },
      targetTextRef: { current: null },
    };
    replacementRanges.push(newRange);
    matchingRanges.push(newRange);

    /// Check if the end of the range should be included, otherwise slice it off and don't return it to the caller, but keep it with its old settings.
    if (endSplitIndex !== contentRange.endIndex) {
      replacementRanges.push({
        startIndex: endSplitIndex,
        endIndex: contentRange.endIndex,
        identifiers: contentRange.identifiers,
        metrics: contentRange.metrics,
        annotations: contentRange.annotations,
        hasPendingAnnotation: contentRange.hasPendingAnnotation,
        content: contentRange.content.slice(
          endSplitIndex - contentRange.startIndex,
          contentRange.endIndex - contentRange.startIndex,
        ),
        targetHighlightRef: { current: null },
        targetHoverRef: { current: null },
        targetTextRef: { current: null },
      });
    }
  }

  contentRanges.splice(rangeStartIndex, rangesToReplace.length, ...replacementRanges);

  return matchingRanges;
}

/**
 * Split content ranges at specific character positions.
 *
 * Unlike splitContent which searches for a matching string, this takes direct start/end character positions.
 * Returns empty array if positions are invalid.
 */
export function splitContentByPosition({
  contentRanges,
  startIndex,
  endIndex,
}: {
  contentRanges: ContentRange[];
  startIndex: number;
  endIndex: number;
}): ContentRange[] {
  if (startIndex < 0 || endIndex <= startIndex) return [];

  const rangeStartIndex = findRangeIndex(contentRanges, startIndex);
  const rangeEndIndex = findRangeIndex(contentRanges, endIndex - 1);
  if (rangeStartIndex < 0) return [];

  const rangesToReplace = contentRanges.slice(rangeStartIndex, rangeEndIndex + 1);
  const replacementRanges: ContentRange[] = [];
  const matchingRanges: ContentRange[] = [];

  for (const contentRange of rangesToReplace) {
    const startSplitIndex = Math.max(startIndex, contentRange.startIndex);
    const endSplitIndex = Math.min(endIndex, contentRange.endIndex);

    if (startSplitIndex === contentRange.startIndex && endSplitIndex === contentRange.endIndex) {
      const newRange: ContentRange = {
        startIndex: contentRange.startIndex,
        endIndex: contentRange.endIndex,
        identifiers: [...contentRange.identifiers],
        metrics: new Set(contentRange.metrics),
        annotations: new Set(contentRange.annotations),
        hasPendingAnnotation: contentRange.hasPendingAnnotation,
        content: contentRange.content,
        targetHighlightRef: { current: null },
        targetHoverRef: { current: null },
        targetTextRef: { current: null },
      };
      replacementRanges.push(newRange);
      matchingRanges.push(newRange);
      continue;
    }

    if (startSplitIndex !== contentRange.startIndex) {
      replacementRanges.push({
        startIndex: contentRange.startIndex,
        endIndex: startSplitIndex,
        identifiers: contentRange.identifiers,
        metrics: contentRange.metrics,
        annotations: contentRange.annotations,
        hasPendingAnnotation: contentRange.hasPendingAnnotation,
        content: contentRange.content.slice(0, startSplitIndex - contentRange.startIndex),
        targetHighlightRef: { current: null },
        targetHoverRef: { current: null },
        targetTextRef: { current: null },
      });
    }

    const newRange: ContentRange = {
      startIndex: startSplitIndex,
      endIndex: endSplitIndex,
      identifiers: [...contentRange.identifiers],
      metrics: new Set(contentRange.metrics),
      annotations: new Set(contentRange.annotations),
      hasPendingAnnotation: contentRange.hasPendingAnnotation,
      content: contentRange.content.slice(
        startSplitIndex - contentRange.startIndex,
        endSplitIndex - contentRange.startIndex,
      ),
      targetHighlightRef: { current: null },
      targetHoverRef: { current: null },
      targetTextRef: { current: null },
    };
    replacementRanges.push(newRange);
    matchingRanges.push(newRange);

    if (endSplitIndex !== contentRange.endIndex) {
      replacementRanges.push({
        startIndex: endSplitIndex,
        endIndex: contentRange.endIndex,
        identifiers: contentRange.identifiers,
        metrics: contentRange.metrics,
        annotations: contentRange.annotations,
        hasPendingAnnotation: contentRange.hasPendingAnnotation,
        content: contentRange.content.slice(
          endSplitIndex - contentRange.startIndex,
          contentRange.endIndex - contentRange.startIndex,
        ),
        targetHighlightRef: { current: null },
        targetHoverRef: { current: null },
        targetTextRef: { current: null },
      });
    }
  }

  contentRanges.splice(rangeStartIndex, rangesToReplace.length, ...replacementRanges);

  return matchingRanges;
}

// MARK: - Helper Components

export const ArtifactColumn = ({
  commonArtifactPath,
  node,
  contentRanges,
  preContext,
  postContext,
  disconnectedContexts: _disconnectedContexts,
  organizationSlug,
  metricDefinitionForID,
  metricColorForID,
  kindConfigurationForPattern,
  autoScrollToFirstHighlight = false,
  handleTextSelection,
  showAnnotations = false,
  pinnedAnnotationIdentifiers,
}: {
  commonArtifactPath: ArtifactPath;
  organizationSlug: string | null;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
  metricColorForID: (id: MetricID) => CSSColor;
  kindConfigurationForPattern: KindConfigurationLookup;
  autoScrollToFirstHighlight?: boolean;
  handleTextSelection?: MouseEventHandler<HTMLDivElement>;
  showAnnotations?: boolean;
  pinnedAnnotationIdentifiers?: string[];
} & FormattedArtifactContent) => {
  const rangeLookup = useMemo(() => {
    const map = new Map<string, ContentRange[]>();
    for (const contentRange of contentRanges) {
      for (const identifier of contentRange.identifiers) {
        let lookup = map.get(identifier);
        if (!lookup) {
          lookup = [];
          map.set(identifier, lookup);
        }
        lookup.push(contentRange);
      }
    }

    return map;
  }, [contentRanges]);
  const [currentHover, setCurrentHover] = useState<{
    x: number;
    y: number;
    metrics: Metric[];
    annotations: Annotation[];
  } | null>(null);
  const hasPinnedHover = Boolean(
    pinnedAnnotationIdentifiers?.some((identifier) => rangeLookup.get(identifier)?.length),
  );

  const applyHoverStyles = useCallback(
    (identifiers: string[]) => {
      const encounteredRanges = new Set<ContentRange>();
      let anchor: { top: number; right: number; bottom: number; left: number } | null = null;
      const hoveredMetrics = new Set<Metric>();
      const hoveredAnnotations = new Set<Annotation>();
      const metricColorCache = new Map<string, string>();
      const resolveMetricColor = (metric: Metric) => {
        const cached = metricColorCache.get(metric.id);
        if (cached) return cached;
        const color = metricColorForID(metric.id);
        metricColorCache.set(metric.id, color);
        return color;
      };

      for (const identifier of identifiers) {
        const relatedRanges = rangeLookup.get(identifier);
        if (!relatedRanges) continue;
        for (const relatedRange of relatedRanges) {
          if (encounteredRanges.has(relatedRange)) continue;
          encounteredRanges.add(relatedRange);
          const highlightSpan = relatedRange.targetHighlightRef.current;
          const hoverSpan = relatedRange.targetHoverRef.current;
          const textSpan = relatedRange.targetTextRef.current;
          if (!highlightSpan || !hoverSpan || !textSpan) continue;

          const offsetParent = textSpan.offsetParent;
          if (offsetParent) {
            const parentBoundingRect = offsetParent.getBoundingClientRect();
            for (const clientRect of textSpan.getClientRects()) {
              const left = clientRect.left - parentBoundingRect.left + offsetParent.scrollLeft;
              const right = left + clientRect.width;
              const top = clientRect.top - parentBoundingRect.top + offsetParent.scrollTop;
              const bottom = top + clientRect.height;
              if (!anchor) {
                anchor = { top, right, bottom, left };
              } else {
                anchor.top = Math.min(anchor.top, top);
                anchor.right = Math.max(anchor.right, right);
                anchor.bottom = Math.max(anchor.bottom, bottom);
                anchor.left = Math.min(anchor.left, left);
              }
            }

            for (const metric of relatedRange.metrics) {
              hoveredMetrics.add(metric);
            }
            if (showAnnotations) {
              for (const annotation of relatedRange.annotations) {
                hoveredAnnotations.add(annotation);
              }
            }
          }

          textSpan.style.color = Color.textDark;
          textSpan.style.opacity = "1";
          const metricColors = [...relatedRange.metrics].map(resolveMetricColor);
          const hasAnnotationHighlight =
            relatedRange.hasPendingAnnotation || (showAnnotations && relatedRange.annotations.size > 0);
          const annotationColors = hasAnnotationHighlight ? [AnnotationHighlightColor] : [];
          const colors = [...metricColors, ...annotationColors];
          hoverSpan.style.background = renderBackground({ colors, background: Color.contentSurface }) ?? "transparent";
          hoverSpan.style.boxShadow = "0px 0px 0px 1.5px white";
        }
      }

      return (hoveredMetrics.size || hoveredAnnotations.size) && anchor
        ? {
            x: anchor.left + (anchor.right - anchor.left) / 2,
            y: anchor.bottom,
            metrics: [...hoveredMetrics],
            annotations: [...hoveredAnnotations],
          }
        : null;
    },
    [metricColorForID, rangeLookup, showAnnotations],
  );

  const clearHoverStyles = useCallback(
    (identifiers: string[]) => {
      const encounteredRanges = new Set<ContentRange>();
      for (const identifier of identifiers) {
        const relatedRanges = rangeLookup.get(identifier);
        if (!relatedRanges) continue;
        for (const relatedRange of relatedRanges) {
          if (encounteredRanges.has(relatedRange)) continue;
          encounteredRanges.add(relatedRange);
          const highlightSpan = relatedRange.targetHighlightRef.current;
          const hoverSpan = relatedRange.targetHoverRef.current;
          const textSpan = relatedRange.targetTextRef.current;
          if (!highlightSpan || !hoverSpan || !textSpan) continue;

          textSpan.style.color = Color.textDark;
          textSpan.style.opacity = "";
          hoverSpan.style.background = "";
          hoverSpan.style.boxShadow = "";
        }
      }
    },
    [rangeLookup],
  );

  const focusGroupRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pinnedAnnotationIdentifiers || pinnedAnnotationIdentifiers.length === 0 || !hasPinnedHover) return;
    clearHoverStyles([...rangeLookup.keys()]);
    applyHoverStyles(pinnedAnnotationIdentifiers);
    setCurrentHover(null);

    return () => {
      clearHoverStyles(pinnedAnnotationIdentifiers);
      setCurrentHover(null);
    };
  }, [applyHoverStyles, clearHoverStyles, hasPinnedHover, pinnedAnnotationIdentifiers, rangeLookup.keys]);

  useEffect(() => {
    const scrollElement = focusGroupRef.current?.parentElement?.parentElement;
    if (!scrollElement) return;

    // Don't scroll when a new annotation is being created — it would jump the text out of view.
    if (contentRanges.some((range) => range.hasPendingAnnotation)) return;

    const computedPaddingTop = Number.parseInt(getComputedStyle(scrollElement).getPropertyValue("padding-top"), 10);
    const paddingTop = (Number.isNaN(computedPaddingTop) ? 0 : computedPaddingTop) + 4; // Not sure why 4 works, but it needed to be fudged.

    if (autoScrollToFirstHighlight) {
      const firstHighlightedRange = contentRanges.find(
        (range) => range.metrics.size > 0 || (showAnnotations && range.annotations.size > 0),
      );
      const targetSpan = firstHighlightedRange?.targetTextRef.current;

      if (targetSpan) {
        const parentRect = scrollElement.getBoundingClientRect();
        const targetRect = targetSpan.getBoundingClientRect();
        const scrollTop =
          targetRect.top - parentRect.top + scrollElement.scrollTop - scrollElement.clientTop - paddingTop;

        scrollElement.scroll({
          behavior: "instant",
          top: Math.max(scrollTop, 0),
        });
        return;
      }
    }

    const childElement = focusGroupRef.current;
    if (!childElement) return;

    const childRect = childElement.getBoundingClientRect();
    const parentRect = scrollElement.getBoundingClientRect();
    const scrollPosition =
      childRect.top - parentRect.top + scrollElement.scrollTop - scrollElement.clientTop - paddingTop;
    scrollElement.scroll({
      behavior: "instant",
      top: scrollPosition,
    });
  }, [autoScrollToFirstHighlight, contentRanges, showAnnotations]);

  const cleanPathComponents = useMemo(() => {
    const currentArtifactPath = node.artifact?.artifactPath ?? [];
    if (currentArtifactPath.length < commonArtifactPath.length) {
      return currentArtifactPath.map((component) => ({
        ...component,
        hidden: false,
      }));
    }
    const hasPrefix = commonArtifactPath.every(
      (component, index) =>
        currentArtifactPath.at(index)?.id === component.id && currentArtifactPath.at(index)?.kind === component.kind,
    );
    if (!hasPrefix) {
      return currentArtifactPath.map((component) => ({
        ...component,
        hidden: false,
      }));
    }

    return currentArtifactPath.map((component, index) => ({
      ...component,
      hidden: index < commonArtifactPath.length,
    }));
  }, [node.artifact?.artifactPath, commonArtifactPath]);

  return (
    <ArtifactContainer>
      <ArtifactHeader>
        <span>
          {cleanPathComponents.every(({ hidden }) => hidden) && "Content"}
          {cleanPathComponents.flatMap(({ id, hidden }, index) => {
            if (hidden) return [];
            const subPath = cleanPathComponents.slice(0, index + 1);
            const encodedSubPath = encodeArtifactPath(subPath);
            const kindConfiguration = kindConfigurationForPattern(subPath, "one");
            const linkText = kindConfiguration.includesID
              ? kindConfiguration.displayName
              : `${kindConfiguration.displayName}: ${id}`;

            return [
              <Fragment key={encodedSubPath}>
                {organizationSlug ? (
                  <Link href={`/app/${organizationSlug}/artifacts/${encodedSubPath}`}>{linkText}</Link>
                ) : (
                  linkText
                )}
                {index < cleanPathComponents.length - 1 && (
                  // biome-ignore lint/performance/noImgElement: TODO: Replace with CSS.
                  <img
                    src="/assets/chevron-forward.svg"
                    width="10"
                    height="18"
                    alt=""
                    style={{ position: "relative", opacity: 0.5, margin: "0px 10px", top: 3 }}
                  />
                )}
              </Fragment>,
            ];
          })}
        </span>
      </ArtifactHeader>
      <ArtifactContents data-pinned-highlight={hasPinnedHover}>
        <ArtifactHighlightLayer>
          {preContext && (
            <ContextGroup>
              {preContext.contentRanges.map(({ startIndex, content, targetHighlightRef }) => (
                <Highlight key={startIndex} ref={targetHighlightRef}>
                  {content}
                </Highlight>
              ))}
            </ContextGroup>
          )}
          <FocusGroup>
            {contentRanges.map(
              ({
                startIndex,
                content,
                metrics,
                annotations,
                hasPendingAnnotation,
                targetHighlightRef,
                identifiers,
              }) => {
                const metricColors = [...metrics].map((metric) => metricColorForID(metric.id));
                const shouldHighlightAnnotation = hasPendingAnnotation || (showAnnotations && annotations.size > 0);
                const annotationColors = shouldHighlightAnnotation ? [AnnotationHighlightColor] : [];
                const colors = [...metricColors, ...annotationColors];
                const background = renderBackground({ colors, background: Color.contentSurface }) ?? "transparent";
                const style = identifiers.length
                  ? {
                      background,
                      zIndex: Math.min(identifiers.length, 99),
                      boxShadow: "0px 0px 0px 3px white",
                    }
                  : {};

                return (
                  <Highlight key={startIndex} ref={targetHighlightRef} style={style}>
                    {content}
                  </Highlight>
                );
              },
            )}
          </FocusGroup>
          {postContext && (
            <ContextGroup>
              {postContext.contentRanges.map(({ startIndex, content, targetHighlightRef }) => (
                <Highlight key={startIndex} ref={targetHighlightRef}>
                  {content}
                </Highlight>
              ))}
            </ContextGroup>
          )}
        </ArtifactHighlightLayer>
        <ArtifactHoverLayer>
          {preContext && (
            <ContextGroup>
              {preContext.contentRanges.map(({ startIndex, content, targetHighlightRef }) => (
                <Highlight key={startIndex} ref={targetHighlightRef}>
                  {content}
                </Highlight>
              ))}
            </ContextGroup>
          )}
          <FocusGroup>
            {contentRanges.map(({ startIndex, content, targetHoverRef, identifiers }) => {
              const style = identifiers.length ? { zIndex: 100 + Math.min(identifiers.length, 99) } : {};

              return (
                <Highlight key={startIndex} ref={targetHoverRef} style={style}>
                  {content}
                </Highlight>
              );
            })}
          </FocusGroup>
          {postContext && (
            <ContextGroup>
              {postContext.contentRanges.map(({ startIndex, content, targetHighlightRef }) => (
                <Highlight key={startIndex} ref={targetHighlightRef}>
                  {content}
                </Highlight>
              ))}
            </ContextGroup>
          )}
        </ArtifactHoverLayer>
        <ArtifactTextLayer>
          {preContext && (
            <ContextGroup>
              {preContext.contentRanges.map(({ startIndex, content, targetHighlightRef }) => (
                <Highlight key={startIndex} ref={targetHighlightRef}>
                  {content}
                </Highlight>
              ))}
            </ContextGroup>
          )}
          <FocusGroup ref={focusGroupRef} onMouseUp={handleTextSelection}>
            {contentRanges.map(
              ({ startIndex, content, targetTextRef, metrics, annotations, hasPendingAnnotation, identifiers }) => (
                <Highlight
                  key={startIndex}
                  ref={targetTextRef}
                  data-start-index={startIndex}
                  style={{
                    zIndex: 200,
                  }}
                  data-has-metrics={
                    metrics.size > 0 || hasPendingAnnotation || (showAnnotations && annotations.size > 0)
                  }
                  onPointerEnter={() => {
                    if (hasPinnedHover) return;
                    setCurrentHover(applyHoverStyles(identifiers));
                  }}
                  onPointerLeave={() => {
                    if (hasPinnedHover) return;
                    clearHoverStyles(identifiers);
                    setCurrentHover(null);
                  }}
                >
                  {content}
                </Highlight>
              ),
            )}
          </FocusGroup>
          {postContext && (
            <ContextGroup>
              {postContext.contentRanges.map(({ startIndex, content, targetHighlightRef }) => (
                <Highlight key={startIndex} ref={targetHighlightRef}>
                  {content}
                </Highlight>
              ))}
            </ContextGroup>
          )}
          {currentHover && (
            <HoverLegend
              style={{
                left: currentHover.x,
                top: currentHover.y,
              }}
            >
              <HoverLegendContainer>
                {currentHover.metrics.map((metric) => {
                  return (
                    <HoverLegendMetric key={metric.id} style={{ background: metricColorForID(metric.id) }}>
                      {metricDefinitionForID(metric.id)?.name ?? metric.id}
                    </HoverLegendMetric>
                  );
                })}
                {currentHover.annotations.map((annotation) => {
                  return (
                    <HoverLegendMetric key={annotation.id} style={{ background: AnnotationHighlightColor }}>
                      Annotation
                    </HoverLegendMetric>
                  );
                })}
              </HoverLegendContainer>
            </HoverLegend>
          )}
        </ArtifactTextLayer>
      </ArtifactContents>
    </ArtifactContainer>
  );
};
ArtifactColumn.displayName = "ArtifactColumn";

// MARK: - Content Widget Component

export const ContentWidgetComponent = ({
  widget,
  currentNode,
  activeEventSummaryID,
  nodesByID,
  selectedMetricsState,
  commonArtifactPath,
  organizationSlug,
  metricDefinitionForID,
  metricColorForID,
  kindConfigurationForPattern,
  autoScrollToFirstHighlight = false,
  pendingAnnotationSelection,
  activeAnnotationSelections,
  onAnnotationSelection,
  showAnnotations = false,
}: {
  widget: ContentWidget;
  currentNode: ArtifactNode | null;
  artifactSelector?: ArtifactSelector | null;
  activeEventSummaryID?: string | null;
  nodes: ArtifactNode[] | null;
  nodesByID: Map<string, ArtifactNode[]>;
  currentSelectionState?: StateObject<ArtifactNode | null>;
  selectedMetricsState: StateObject<Map<string, Metric>>;
  commonArtifactPath: ArtifactPath | undefined;
  organizationSlug: string | null;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
  metricColorForID: (id: MetricID) => CSSColor;
  kindConfigurationForPattern: KindConfigurationLookup;
  autoScrollToFirstHighlight?: boolean;
  pendingAnnotationSelection?: ArtifactAnnotationSelection | null;
  activeAnnotationSelections?: ArtifactAnnotationSelection[];
  onAnnotationSelection?: (selection: ArtifactAnnotationSelection) => void;
  showAnnotations?: boolean;
}) => {
  /// Context

  /// State

  const { childArtifactPath, showsContext: _showsContext } = widget;

  const [selectedMetrics] = useBinding(selectedMetricsState);

  const artifactData = useMemo(() => {
    const node = currentNode?.childArtifactWithPath(childArtifactPath);
    const snapshot = activeEventSummaryID
      ? node?.artifact?.snapshots?.findLast(({ eventSummaryID }) => eventSummaryID === activeEventSummaryID)
      : node?.artifact?.snapshots?.at(-1);
    const content = snapshot?.content;
    if (!node || typeof content !== "string") return null;

    const sources =
      node.artifact?.sourceArtifactPaths?.flatMap((artifactPath) => {
        const sourceCandidates = nodesByID.get(encodeArtifactPath(artifactPath)) ?? [];
        return sourceCandidates.filter((source) => typeof source.artifact?.snapshots?.at(-1)?.content === "string");
      }) ?? [];

    let preContext: ArtifactContextRanges | undefined;
    let postContext: ArtifactContextRanges | undefined;
    const disconnectedContexts: ArtifactContextRanges[] = [];

    for (const source of sources) {
      const sourceContent = source.artifact?.snapshots?.at(-1)?.content;
      if (typeof sourceContent !== "string") continue;
      const contentMatchIndex = sourceContent.indexOf(content);
      if (contentMatchIndex < 0 || preContext || postContext) {
        disconnectedContexts.push({
          node: source,
          contentRanges: [
            {
              startIndex: 0,
              endIndex: sourceContent.length,
              content: sourceContent,
              identifiers: [],
              metrics: new Set(),
              annotations: new Set(),
              hasPendingAnnotation: false,
              targetHighlightRef: { current: null },
              targetHoverRef: { current: null },
              targetTextRef: { current: null },
            },
          ],
        });
      } else {
        const prefix = sourceContent.slice(0, contentMatchIndex);
        const suffix = sourceContent.slice(contentMatchIndex + content.length, sourceContent.length);

        if (prefix.length) {
          preContext = {
            node: source,
            contentRanges: [
              {
                startIndex: 0,
                endIndex: prefix.length,
                content: prefix,
                identifiers: [],
                metrics: new Set(),
                annotations: new Set(),
                hasPendingAnnotation: false,
                targetHighlightRef: { current: null },
                targetHoverRef: { current: null },
                targetTextRef: { current: null },
              },
            ],
          };
        }
        if (suffix.length) {
          postContext = {
            node: source,
            contentRanges: [
              {
                startIndex: 0,
                endIndex: suffix.length,
                content: suffix,
                identifiers: [],
                metrics: new Set(),
                annotations: new Set(),
                hasPendingAnnotation: false,
                targetHighlightRef: { current: null },
                targetHoverRef: { current: null },
                targetTextRef: { current: null },
              },
            ],
          };
        }
      }
    }

    const artifactData: FormattedArtifactContent = {
      node,
      contentRanges: [
        {
          startIndex: 0,
          endIndex: content.length,
          content,
          identifiers: [],
          metrics: new Set(),
          annotations: new Set(),
          hasPendingAnnotation: false,
          targetHighlightRef: { current: null },
          targetHoverRef: { current: null },
          targetTextRef: { current: null },
        },
      ],
      preContext,
      postContext,
      disconnectedContexts,
    };

    const nodeMap = new Map(sources.concat(node).map((node) => [node.id, node]));

    for (const [_, metric] of selectedMetrics) {
      const examples = metric.values.flatMap((recording) => recording.examples ?? []);
      for (const [index, example] of examples.entries()) {
        const encodedArtifactPath = encodeArtifactPath(example.artifactPath);
        const node = nodeMap.get(encodedArtifactPath);
        if (!node) continue;

        /// Don't bother cutting the content if we don't have a matching string.
        const matchingContent = example.matchingContent;
        if (typeof matchingContent !== "string") continue;

        /// Cut the content in place, and update the newly-cut ranges with metrics and identifiers.
        const newRanges = splitContent({ content, contentRanges: artifactData.contentRanges, matchingContent });
        for (const newRange of newRanges) {
          newRange.identifiers.push(`${metric.id}-${index}`);
          newRange.metrics.add(metric);
        }
      }
    }

    if (showAnnotations) {
      const snapshotAnnotations = snapshot?.annotations ?? {};
      for (const [annotationID, annotation] of Object.entries(snapshotAnnotations)) {
        if (annotation.isDeleted) continue;
        const { start, end } = annotation.location;
        const newRanges = splitContentByPosition({
          contentRanges: artifactData.contentRanges,
          startIndex: start,
          endIndex: end,
        });
        for (const newRange of newRanges) {
          newRange.identifiers.push(`annotation-${annotationID}`);
          newRange.annotations.add(annotation);
        }
      }
    }

    // Highlight a pending (unsaved) annotation selection inline as soon as it is made.
    const artifactPath = node.artifact?.artifactPath;
    if (artifactPath && pendingAnnotationSelection) {
      const matchesArtifact = isSameArtifact(pendingAnnotationSelection, [encodeArtifactPath(artifactPath)]);
      const matchesSnapshot = isSameSnapshot(pendingAnnotationSelection, activeEventSummaryID);

      if (matchesArtifact && matchesSnapshot) {
        const { start, end } = pendingAnnotationSelection.selectionRange;
        const newRanges = splitContentByPosition({
          contentRanges: artifactData.contentRanges,
          startIndex: start,
          endIndex: end,
        });
        for (const newRange of newRanges) {
          newRange.identifiers.push("pending-annotation");
          newRange.hasPendingAnnotation = true;
        }
      }
    }

    return artifactData;
  }, [
    selectedMetrics,
    nodesByID,
    currentNode,
    childArtifactPath,
    activeEventSummaryID,
    showAnnotations,
    pendingAnnotationSelection,
  ]);

  const pinnedAnnotationIdentifiers = useMemo(() => {
    const artifactPath = artifactData?.node.artifact?.artifactPath;
    if (!artifactPath) return [];

    const identifiers: string[] = [];
    if (pendingAnnotationSelection) {
      const matchesArtifact = isSameArtifact(pendingAnnotationSelection, [encodeArtifactPath(artifactPath)]);
      const matchesSnapshot = isSameSnapshot(pendingAnnotationSelection, activeEventSummaryID);
      if (matchesArtifact && matchesSnapshot) identifiers.push("pending-annotation");
    }

    for (const selection of activeAnnotationSelections ?? []) {
      if (!selection.annotationID) continue;
      const matchesArtifact = isSameArtifact(selection, [encodeArtifactPath(artifactPath)]);
      const matchesSnapshot = isSameSnapshot(selection, activeEventSummaryID);
      if (matchesArtifact && matchesSnapshot) {
        identifiers.push(`annotation-${selection.annotationID}`);
      }
    }

    return identifiers;
  }, [
    activeAnnotationSelections,
    activeEventSummaryID,
    artifactData?.node.artifact?.artifactPath,
    pendingAnnotationSelection,
  ]);

  /// Actions
  const handleTextSelection = useCallback<MouseEventHandler<HTMLSpanElement>>(() => {
    if (!onAnnotationSelection || !artifactData?.contentRanges.length) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const startElement =
      (range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement
      )?.closest<HTMLElement>("[data-start-index]") ?? null;
    const endElement =
      (range.endContainer instanceof Element
        ? range.endContainer
        : range.endContainer.parentElement
      )?.closest<HTMLElement>("[data-start-index]") ?? null;
    if (!startElement || !endElement) return;

    const selectionStartIndex = Number.parseInt(startElement.dataset.startIndex ?? "", 10) + range.startOffset;
    const selectionEndIndex = Number.parseInt(endElement.dataset.startIndex ?? "", 10) + range.endOffset;
    if (!Number.isFinite(selectionStartIndex) || !Number.isFinite(selectionEndIndex)) return;

    const start = Math.max(0, Math.min(selectionStartIndex, selectionEndIndex));
    const end = Math.max(selectionStartIndex, selectionEndIndex);
    const contentEnd = artifactData.contentRanges.at(-1)?.endIndex ?? 0;
    if (end <= start || start >= contentEnd) return;

    const selectedText = selection.toString();
    if (!selectedText.trim()) return;

    const artifactPath = artifactData.node.artifact?.artifactPath;
    if (!artifactPath) return;

    onAnnotationSelection({
      artifactPath,
      selectionRange: { start, end: Math.min(end, contentEnd) },
      selectedText,
      eventSummaryID: activeEventSummaryID ?? null,
    });
  }, [activeEventSummaryID, artifactData, onAnnotationSelection]);

  /// Component

  if (!currentNode?.artifact || !artifactData) {
    return;
  }

  return (
    <Container>
      <ArtifactColumn
        commonArtifactPath={commonArtifactPath ?? currentNode.artifact.artifactPath}
        node={artifactData.node}
        contentRanges={artifactData.contentRanges}
        preContext={artifactData.preContext}
        postContext={artifactData.postContext}
        disconnectedContexts={artifactData.disconnectedContexts}
        organizationSlug={organizationSlug}
        metricDefinitionForID={metricDefinitionForID}
        metricColorForID={metricColorForID}
        kindConfigurationForPattern={kindConfigurationForPattern}
        autoScrollToFirstHighlight={autoScrollToFirstHighlight}
        handleTextSelection={handleTextSelection}
        showAnnotations={showAnnotations}
        pinnedAnnotationIdentifiers={pinnedAnnotationIdentifiers}
      />
    </Container>
  );
};
ContentWidgetComponent.displayName = "ContentWidgetComponent";
