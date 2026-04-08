import { useContext, useEffect, useMemo, useRef } from "react";
import styled, { css } from "styled-components";

import type { Annotation, AnnotationLocation, ArtifactPath, ArtifactSnapshot } from "@/generated/serverTypes";

import { NamedComponent } from "@/library/NamedComponent";
import type { StateObject } from "@/library/StateObject";

import type { TypedArtifactSnapshot } from "@/model/artifactNode";

import {
  ArtifactAnnotation,
  type ArtifactAnnotationPayload,
  type ArtifactAnnotationSelection,
} from "@/components/ArtifactAnnotation";
import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import { Color, Font } from "@/components/ui";
import type { CheckboxState } from "@/components/ui/Checkbox";

const Container = styled.div`${() => css`
  font-family: ${Font.inter};
  display: flex;
  flex-direction: column;
  background: ${Color.contentSurface};
  padding-top: 16px;
`}`;

const List = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0px 16px;
`}`;

const EmptyState = styled.div`${() => css`
  color: ${Color.mutedText};
  font-family: ${Font.inter};
  border-radius: 6px;
  padding: 0px 12px;
  margin: 0px 16px;
`}`;

const normalizeTimestamp = (value?: string) => (value ? new Date(value).toISOString() : undefined);

const extractSelectedText = (content: ArtifactSnapshot["content"], location: AnnotationLocation) => {
  if (typeof content !== "string") return "";
  const safeStart = Math.max(0, Math.min(location.start, content.length));
  const safeEnd = Math.max(safeStart, Math.min(location.end, content.length));
  return content.slice(safeStart, safeEnd);
};

export const ArtifactAnnotationsList = NamedComponent(
  "ArtifactAnnotationsList",
  ({
    artifactSnapshots,
    pendingAnnotationSelection,
    onAnnotationCreate,
    onAnnotationSave,
    onAnnotationDelete,
    onAnnotationCancel,
    onAnnotationEditStart,
    onAnnotationEditEnd,
  }: {
    artifactSnapshots?: Array<TypedArtifactSnapshot | null | undefined>;
    visibilityState: StateObject<CheckboxState>;
    pendingAnnotationSelection?: ArtifactAnnotationSelection | null;
    onAnnotationCreate?: (payload: ArtifactAnnotationPayload) => void;
    onAnnotationSave?: (artifactPath: ArtifactPath, annotation: Annotation, payload: ArtifactAnnotationPayload) => void;
    onAnnotationDelete?: (artifactPath: ArtifactPath, annotation: Annotation) => void;
    onAnnotationCancel?: () => void;
    onAnnotationEditStart?: (selection: ArtifactAnnotationSelection) => void;
    onAnnotationEditEnd?: (selection: ArtifactAnnotationSelection) => void;
  }) => {
    const { kindConfigurationForPattern } = useContext(OrganizationContext);
    const pendingAnnotationRef = useRef<HTMLDivElement | null>(null);

    const snapshots = useMemo(
      () => (artifactSnapshots ?? []).filter((s): s is TypedArtifactSnapshot => s != null),
      [artifactSnapshots],
    );

    useEffect(() => {
      if (!pendingAnnotationSelection) return;
      pendingAnnotationRef.current?.scrollIntoView({ block: "start" });
    }, [pendingAnnotationSelection]);

    const visibleAnnotationsBySnapshot = useMemo(() => {
      return snapshots.map((snapshot) => {
        const artifactPathLeaf = snapshot.artifactPath?.at(-1);
        const artifactRole =
          artifactPathLeaf?.id && ["input", "output"].includes(artifactPathLeaf?.id) ? artifactPathLeaf?.id : "root";
        const snapshotKey = `${artifactRole}-${snapshot.eventSummaryID ?? snapshot.timestamp?.toISOString()}`;

        const kindConfiguration = kindConfigurationForPattern(snapshot.artifactPath ?? [], "one");
        const title = snapshot.metadata?.name || kindConfiguration.displayName || "Artifact";

        const visibleAnnotations = Object.values(snapshot.annotations ?? {})
          .filter((annotation) => !annotation.isDeleted)
          .slice()
          .sort((left, right) => left.location.start - right.location.start);

        return { snapshot, title, snapshotKey, annotations: visibleAnnotations };
      });
    }, [snapshots, kindConfigurationForPattern]);

    return (
      <Container>
        {snapshots.length > 0 &&
          snapshots.some((s) => s.content) &&
          (() => {
            const annotationComponents = [];

            if (pendingAnnotationSelection) {
              annotationComponents.push(
                <div key="new-annotation" ref={pendingAnnotationRef}>
                  <ArtifactAnnotation
                    selectionRange={pendingAnnotationSelection.selectionRange}
                    selectedText={pendingAnnotationSelection.selectedText}
                    content=""
                    initialMode="create"
                    onSave={onAnnotationCreate}
                    onCancel={onAnnotationCancel}
                  />
                </div>,
              );
            }

            annotationComponents.push(
              ...visibleAnnotationsBySnapshot.flatMap(({ snapshot, snapshotKey, annotations }) => {
                if (!snapshot.content || typeof snapshot.content !== "string") return [];
                if (annotations.length === 0) return [];

                return [
                  ...annotations.map((annotation) => {
                    const artifactPath = snapshot.artifactPath;
                    const selectedText = extractSelectedText(snapshot.content, annotation.location);
                    const annotationSelection: ArtifactAnnotationSelection | null = artifactPath
                      ? {
                          artifactPath,
                          selectionRange: annotation.location,
                          selectedText,
                          eventSummaryID: snapshot.eventSummaryID ?? null,
                          annotationID: annotation.id,
                        }
                      : null;

                    return (
                      <ArtifactAnnotation
                        key={`${snapshotKey}-${annotation.id}`}
                        selectionRange={annotation.location}
                        selectedText={selectedText}
                        content={annotation.content}
                        updatedAt={normalizeTimestamp(annotation.modifiedTimestamp)}
                        initialMode="view"
                        onSave={
                          onAnnotationSave && artifactPath
                            ? (payload) => onAnnotationSave(artifactPath, annotation, payload)
                            : undefined
                        }
                        onDelete={
                          onAnnotationDelete && artifactPath
                            ? () => onAnnotationDelete(artifactPath, annotation)
                            : undefined
                        }
                        onCancel={onAnnotationCancel}
                        onEditStart={
                          annotationSelection && onAnnotationEditStart
                            ? () => onAnnotationEditStart(annotationSelection)
                            : undefined
                        }
                        onEditEnd={
                          annotationSelection && onAnnotationEditEnd
                            ? () => onAnnotationEditEnd(annotationSelection)
                            : undefined
                        }
                      />
                    );
                  }),
                ];
              }),
            );

            if (annotationComponents.length === 0) {
              return <EmptyState>No annotations available</EmptyState>;
            }

            return <List>{annotationComponents}</List>;
          })()}
      </Container>
    );
  },
);
