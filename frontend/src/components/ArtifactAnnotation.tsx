import { useCallback, useEffect, useMemo, useState } from "react";
import styled, { css } from "styled-components";

import type { ArtifactPath } from "@/generated/serverTypes";

import { NamedComponent } from "@/library/NamedComponent";
import { useBinding, useStateObject } from "@/library/StateObject";

import { encodeArtifactPath } from "@/model/artifactPath";

import { Button, Color, Font, Label, Size, TextField } from "@/components/ui";

// MARK: - Types

export type ArtifactAnnotationMode = "create" | "edit" | "view";

export type ArtifactAnnotationSelectionRange = {
  start: number;
  end: number;
};

export type ArtifactAnnotationSelection = {
  artifactPath: ArtifactPath;
  selectionRange: ArtifactAnnotationSelectionRange;
  selectedText: string;
  eventSummaryID?: string | null;
  annotationID?: string;
};

export type ArtifactAnnotationPayload = {
  selectionRange: ArtifactAnnotationSelectionRange;
  selectedText: string;
  content: string;
  updatedAt?: string;
};

export function isSameArtifact(selection: ArtifactAnnotationSelection, encodedPaths: string | string[]) {
  const encodedSelectionPath = encodeArtifactPath(selection.artifactPath);
  if (Array.isArray(encodedPaths)) {
    return encodedPaths.includes(encodedSelectionPath);
  }
  return encodedSelectionPath === encodedPaths;
}

export const isSameSnapshot = (selection: ArtifactAnnotationSelection, eventSummaryID: string | null | undefined) =>
  selection.eventSummaryID == null || selection.eventSummaryID === eventSummaryID;

// MARK: - Constants

const AnnotationContainer = styled.div`${() => css`
  font-family: ${Font.inter};
  font-size: 15px;
  background: ${Color.contentSurface};
  display: flex;
  flex-direction: column;
  gap: 12px;
`}`;

const Timestamp = styled.div`${() => css`
  font-size: 13px;
  color: ${Color.mutedText};
`}`;

const SelectedTextBlock = styled.div`${() => css`
  border-radius: 12px;
  background: ${Color.surfaceOffWhite};
  padding: 10px 12px;
  font-family: ${Font.ibmPlexSans};
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 300;
  color: ${Color.textDark};
  white-space: pre-wrap;
`}`;

const Section = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  gap: 6px;
`}`;

const AnnotationContent = styled.div`${() => css`
  white-space: pre-wrap;
  background: ${Color.surfaceOffWhite};
  padding: 10px 12px;
  font-family: ${Font.ibmPlexSans};
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 300;
  color: ${Color.textDark};
  border-radius: 12px;
`}`;

const ActionsRow = styled.div`${() => css`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
`}`;

const AnnotationTextField = styled(TextField)`${() => css`
  input,
  textarea {
    min-height: 84px;
    border-radius: 12px;
    border: none;
    background-color: ${Color.surfaceDivider};
    padding: 10px 12px;

    font-family: ${Font.ibmPlexSans};
    font-size: ${Size.fontSize.fontSize14};
    font-weight: 300;
    color: ${Color.textDark};
  }

  textarea {
    resize: vertical;
  }
`}`;

// MARK: - Helpers

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const normalizeTimestamp = (value?: Date | string) => {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return value;
};

// MARK: - Component

export const ArtifactAnnotation = NamedComponent(
  "ArtifactAnnotation",
  ({
    selectionRange,
    selectedText,
    content = "",
    updatedAt,
    initialMode = "view",
    onSave,
    onCancel,
    onDelete,
    onEditStart,
    onEditEnd,
  }: {
    selectionRange: ArtifactAnnotationSelectionRange;
    selectedText: string;
    content?: string;
    updatedAt?: Date | string;
    initialMode?: ArtifactAnnotationMode;
    onSave?: (payload: ArtifactAnnotationPayload) => void;
    onCancel?: () => void;
    onDelete?: () => void;
    onEditStart?: () => void;
    onEditEnd?: () => void;
  }) => {
    const [mode, setMode] = useState<ArtifactAnnotationMode>(initialMode);
    const [displayedContent, setDisplayedContent] = useState(content);
    const [timestamp, setTimestamp] = useState<string | undefined>(() => {
      return normalizeTimestamp(updatedAt);
    });
    const contentState = useStateObject(content);
    const [annotationContent, setAnnotationContent] = useBinding(contentState);

    useEffect(() => {
      setDisplayedContent(content);
      setAnnotationContent(content);
    }, [content, setAnnotationContent]);

    useEffect(() => {
      if (updatedAt) setTimestamp(normalizeTimestamp(updatedAt));
    }, [updatedAt]);

    const formattedTimestamp = useMemo(
      () => (timestamp ? dateFormatter.format(new Date(timestamp)) : null),
      [timestamp],
    );
    const isSaveEnabled = useMemo(() => !!annotationContent?.trim(), [annotationContent]);

    const handleSave = useCallback(() => {
      if (!isSaveEnabled) return;
      const savedContent = annotationContent ?? "";
      const savedTimestamp = new Date().toISOString();
      setDisplayedContent(savedContent);
      setTimestamp(savedTimestamp);
      setMode("view");
      if (mode === "edit") {
        onEditEnd?.();
      }
      onSave?.({
        selectionRange,
        selectedText,
        content: savedContent,
        updatedAt: savedTimestamp,
      });
    }, [annotationContent, isSaveEnabled, mode, onEditEnd, onSave, selectedText, selectionRange]);

    const handleCancel = useCallback(() => {
      contentState.wrappedValue = displayedContent;
      if (mode === "edit") {
        setMode("view");
        onEditEnd?.();
      }
      onCancel?.();
    }, [contentState, displayedContent, mode, onCancel, onEditEnd]);

    const handleDelete = useCallback(() => {
      if (mode === "edit") {
        onEditEnd?.();
      }
      onDelete?.();
    }, [mode, onDelete, onEditEnd]);

    const isViewing = mode === "view";
    const isEditing = mode === "edit";

    return (
      <AnnotationContainer data-mode={mode}>
        <Section>
          <Label>Selected text</Label>
          <SelectedTextBlock>{selectedText || "No text selected."}</SelectedTextBlock>
        </Section>
        {isViewing ? (
          <Section>
            <Label>Annotation</Label>
            <AnnotationContent>{displayedContent || "No annotation has been added yet."}</AnnotationContent>
            {formattedTimestamp ? <Timestamp>Last updated {formattedTimestamp}</Timestamp> : null}
            <ActionsRow>
              <Button
                prominence="secondary"
                action={() => {
                  setMode("edit");
                  onEditStart?.();
                }}
              >
                Edit
              </Button>
            </ActionsRow>
          </Section>
        ) : (
          <>
            <Section>
              <Label>Annotation</Label>
              <AnnotationTextField valueState={contentState} isMultiline placeholder="Add notes for this selection" />
            </Section>
            <Timestamp>Not yet saved</Timestamp>
            <ActionsRow>
              {isEditing ? (
                <Button action={handleDelete} style={{ marginRight: "auto" }} isDangerous>
                  Delete
                </Button>
              ) : null}
              <Button action={handleCancel} keyEquivalent="Escape">
                Cancel
              </Button>
              <Button action={handleSave} isEnabled={isSaveEnabled} keyEquivalent="Enter">
                Save
              </Button>
            </ActionsRow>
          </>
        )}
      </AnnotationContainer>
    );
  },
);
