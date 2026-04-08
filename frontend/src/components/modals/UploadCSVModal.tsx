import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { css } from "styled-components";

import { type StateObject, useBinding, useStateObject } from "@/library/StateObject";

import { ItemNode } from "@/model/keyPath";

import { TextFileLoader } from "@/components/FileTextLoader";
import { Button, Color, Font, ModalPanel, Size, StatusIcon, Table, type TableColumnDescriptor } from "@/components/ui";

import { requiredValueValidator } from "@/lib/csvUpload";
import {
  CSV_HEADER_ROW_OFFSET,
  type CSVColumnDefinition,
  type UploadCSVParser,
  type UploadCSVParserResult,
} from "@/types/csv";

// MARK: - Types

export type { CSVColumnDefinition } from "@/types/csv";

export type UploadCSVModalOnUpload = ({
  summary,
  contents,
  parsed,
  errorRowIndices,
}: {
  summary: ParseSummary;
  contents: string;
  parsed: readonly (Readonly<Record<string, unknown>> | null)[];
  errorRowIndices: ReadonlySet<number>;
}) => Promise<void>;

type ParseSummary = {
  fileName: string;
  fileSizeBytes: number;
  rowsAdded: number;
  rowsFailed: number;
  fatalError?: string;
};

type CSVPreviewRow = {
  rowNumber: number;
  values: Record<string, string | null>;
  invalidMessage?: string;
};

const progressBarHeight = 16;

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const formatted = size < 10 ? size.toFixed(1) : Math.round(size).toString();
  return `${formatted} ${units[unitIndex]}`;
};

const formatFailedRowsMessage = (errorRows: ReadonlySet<number>) => {
  const sortedRowIndices = Array.from(errorRows)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const displayedRows = sortedRowIndices.slice(0, 5);
  const remaining = Math.max(sortedRowIndices.length - displayedRows.length, 0);
  const rowList = displayedRows.map((index) => index + CSV_HEADER_ROW_OFFSET).join(", ");
  const rowsSummary = rowList || "unknown";
  return `Index of invalid rows: ${rowsSummary}${remaining > 0 ? ` (+${remaining} more)` : ""}`;
};

const UploadModalContainer = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  box-sizing: border-box;
  border-radius: 16px;
  overflow-y: auto;
  
`}`;

const UploadModalTitle = styled.h1`${() => css`
  margin: 0px;
  font-size: ${Size.fontSize.fontSize16};
  color: ${Color.textDark};
  font-weight: 500;
  line-height: 1.1;
`}`;

const UploadModalSubtitle = styled.p`${() => css`
  margin: 0px;
  font-size: ${Size.fontSize.fontSize14};
  font-family: ${Font.ibmPlexSans};
  color: ${Color.textDark};
  font-weight: 400;
  line-height: 1.2;
`}`;

const UploadBox = styled.div`${() => css`
  border: ${Size.line.thickness} solid ${Color.line};
  border-radius: 16px;
  padding: 18px;
  background-color: ${Color.contentSurface};
  display: flex;
  flex-direction: column;
  gap: 18px;
`}`;

const ExpectedColumns = styled.div`${() => css`
  font-size: ${Size.fontSize.fontSize14};
  font-family: ${Font.ibmPlexSans};
  color: ${Color.mutedText};
`}`;

const FileStatusRow = styled.div`${() => css`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: ${Size.fontSize.fontSize14};
  font-family: ${Font.ibmPlexSans};
`}`;

const FileStatusDetails = styled.div`${() => css`
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
`}`;

const FileNameText = styled.span`${() => css`
  color: ${Color.emphasizedText};
  font-weight: 500;
`}`;

const FileSizeText = styled.span`${() => css`
  color: ${Color.mutedText};
  font-size: ${Size.fontSize.fontSize14};
  font-family: ${Font.ibmPlexSans};
`}`;

const FileStatusIcon = styled(StatusIcon)`${() => css`
  flex-shrink: 0;
`}`;

const StatsContainer = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: ${Size.fontSize.fontSize14};
  font-family: ${Font.ibmPlexSans};
  color: ${Color.mutedText};
`}`;

const StatLine = styled.div`${() => css`
  display: flex;
  align-items: center;
  gap: 8px;
`}`;

const StatText = styled.span`${() => css`
  display: flex;
  align-items: baseline;
  gap: 4px;
`}`;

const StatValue = styled.span`${() => css`
  color: ${Color.emphasizedText};
  font-size: ${Size.fontSize.fontSize14};
  font-family: ${Font.ibmPlexSans};
  font-weight: 500;
`}`;

const StatStatusIcon = styled(StatusIcon)`${() => css`
  flex-shrink: 0;
`}`;

const ErrorList = styled.div`${() => css`
  margin: 4px 0 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`}`;

const ErrorLine = styled.p`${() => css`
  margin: 0;
  font-size: ${Size.fontSize.fontSize14};
  color: ${Color.danger};
`}`;

const TableSection = styled.div`${() => css`
  padding: 1px;
  max-height: 220px;
  
  thead th {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  tbody td {
    overflow: hidden;
    text-overflow: ellipsis;
    
  }
`}`;

const ProgressContainer = styled.div`${() => css`
  display: flex;
  align-items: center;
`}`;

const ButtonHStack = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: row;
  gap: 8px;
  justify-content: end;
  align-items: center;
  
`}`;

// MARK: - Component

export const UploadCSVModal = ({
  isPresentedState,
  columnDefinitions,
  parseCSV,
  onUpload,
  exampleRow,
}: {
  isPresentedState: StateObject<boolean>;
  columnDefinitions: readonly CSVColumnDefinition[];
  parseCSV: UploadCSVParser;
  onUpload?: UploadCSVModalOnUpload;
  width?: string;
  exampleRow?: string;
}) => {
  const wasModalOpenRef = useRef(false);
  const [isPresented, setIsPresented] = useBinding(isPresentedState);
  const fileContentsState = useStateObject("");
  const fileState = useStateObject<File | null>(null);
  const [parseSummary, setParseSummary] = useState<ParseSummary | null>(null);
  const [parseResult, setParseResult] = useState<UploadCSVParserResult | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const parseFile = useCallback(
    async ({ file }: { file: File }) => {
      const contents = await file.text();
      try {
        const parsed = await parseCSV({ contents, columnDefinitions });
        setParseResult(parsed);
        setParseSummary({
          fileName: file.name,
          fileSizeBytes: file.size,
          rowsAdded: parsed.validRowCount,
          rowsFailed: parsed.errorRows.size,
          fatalError: parsed.fatalError,
        });
      } catch (error) {
        console.error("Unable to parse CSV file", error);
        setParseSummary({
          fileName: file.name,
          fileSizeBytes: file.size,
          rowsAdded: 0,
          rowsFailed: 0,
          fatalError: "Unable to parse CSV file",
        });
        setParseResult(null);
      } finally {
        fileContentsState.wrappedValue = contents;
      }
    },
    [columnDefinitions, fileContentsState, parseCSV],
  );

  useEffect(() => {
    if (fileState.wrappedValue) {
      parseFile({ file: fileState.wrappedValue });
    } else {
      setParseSummary(null);
      setParseResult(null);
      fileContentsState.wrappedValue = "";
    }
  }, [fileContentsState, fileState.wrappedValue, parseFile]);

  // Closing the modal resets its state.

  const resetModalState = useCallback(() => {
    fileContentsState.wrappedValue = "";
    fileState.wrappedValue = null;
    setParseSummary(null);
    setParseResult(null);
  }, [fileContentsState, fileState]);

  useEffect(() => {
    if (!isPresented && wasModalOpenRef.current) {
      resetModalState();
    }
    if (isPresented) {
      wasModalOpenRef.current = true;
    }
  }, [isPresented, resetModalState]);

  const rowsAdded = parseSummary?.rowsAdded ?? 0;
  const rowsFailed = parseSummary?.rowsFailed ?? 0;
  const fatalError = parseSummary?.fatalError;
  const parsedRows = parseResult?.parsedRows ?? [];
  const errorRows = parseResult?.errorRows ?? new Set<number>();
  const isUploadButtonEnabled = Boolean(parseResult && rowsAdded > 0 && !fatalError && !isWorking);

  const {
    columns: tableColumns,
    items: tableItems,
    emptyStateComponent: tableEmptyState,
  } = useMemo<{
    columns: TableColumnDescriptor[];
    items: ItemNode<CSVPreviewRow>[];
    emptyStateComponent: string;
  }>(() => {
    if (!parseSummary) {
      return { columns: [], items: [], emptyStateComponent: "" };
    }

    const baseColumns: TableColumnDescriptor[] = [{ title: "Row", keyPaths: ["rowNumber"], width: 50 }];

    const headerColumns: TableColumnDescriptor[] = columnDefinitions.map(({ title, width }) => ({
      title,
      keyPaths: [`values.${title}`],
      width: width ?? "auto",
    }));

    const items: ItemNode<CSVPreviewRow>[] = [];
    for (const [index, row] of parsedRows.entries()) {
      const isEmptyOrNull = row === null || Object.values(row).every((value) => value === null || value === "");
      const invalidMessage = errorRows.has(index) ? "Invalid row" : undefined;

      const values: Record<string, string | null> = {};
      columnDefinitions.forEach((definition) => {
        if (isEmptyOrNull || invalidMessage) {
          values[definition.title] = "invalid";
          return;
        }
        const value = row?.[definition.title];
        values[definition.title] = value === undefined || value === null ? null : `${value}`;
      });

      items.push(
        new ItemNode<CSVPreviewRow>({
          id: `csv-row-${index}`,
          item: {
            rowNumber: index + CSV_HEADER_ROW_OFFSET,
            values,
            invalidMessage,
          },
        }),
      );
    }

    const emptyStateComponent =
      items.length === 0
        ? parseSummary.rowsAdded === 0 && parseSummary.rowsFailed === 0
          ? "No data loaded"
          : "Invalid data"
        : "";

    return {
      columns: [...baseColumns, ...headerColumns],
      items,
      emptyStateComponent,
    };
  }, [columnDefinitions, parsedRows, parseSummary, errorRows]);

  const handleCancel = useCallback(() => {
    setIsPresented(false);
  }, [setIsPresented]);

  const handleConfirm = useCallback(async () => {
    if (!parseSummary || !parseResult || parseSummary.rowsAdded <= 0 || !onUpload || fatalError) return;
    const errorRowIndices = parseResult.errorRows;
    setIsWorking(true);
    try {
      await onUpload({
        summary: parseSummary,
        contents: fileContentsState.wrappedValue,
        parsed: parseResult.parsedRows,
        errorRowIndices,
      });
      setIsPresented(false);
    } finally {
      setIsWorking(false);
    }
  }, [parseSummary, fileContentsState, onUpload, parseResult, setIsPresented, fatalError]);

  const handleReupload = useCallback(() => {
    if (isWorking) return;
    resetModalState();
  }, [isWorking, resetModalState]);

  const shouldShowReupload = Boolean(parseSummary && (rowsFailed > 0 || fatalError));

  return (
    <ModalPanel isPresentedState={isPresentedState} presentation="form">
      <UploadModalContainer>
        <UploadModalTitle>Upload CSV file</UploadModalTitle>
        <UploadModalSubtitle>Select your CSV file to upload</UploadModalSubtitle>
        <UploadBox>
          {!fileContentsState.wrappedValue
            ? !isWorking && (
                <>
                  {columnDefinitions.length > 0 && (
                    <ExpectedColumns>
                      Required columns:{" " /* force space */}
                      {columnDefinitions
                        .filter((definition) => definition.validators?.includes(requiredValueValidator))
                        .map(
                          (definition) =>
                            `${definition.title}${definition.description ? ` (${definition.description})` : ""}`,
                        )
                        .join(", ")}
                    </ExpectedColumns>
                  )}
                  <TextFileLoader
                    valueState={fileContentsState}
                    fileState={fileState}
                    accept={[".csv"]}
                    buttonLabel="Browse files"
                    description="Select a CSV file from your computer"
                  />
                  {exampleRow && <ExpectedColumns>Example: {exampleRow}</ExpectedColumns>}
                </>
              )
            : parseSummary && (
                <FileStatusRow>
                  {<FileStatusIcon icon={rowsFailed > 0 ? "warning" : "check"} size="regular" />}
                  <FileStatusDetails>
                    <FileNameText title={parseSummary.fileName}>{parseSummary.fileName}</FileNameText>
                    <FileSizeText>({formatFileSize(parseSummary.fileSizeBytes)})</FileSizeText>
                  </FileStatusDetails>
                </FileStatusRow>
              )}
        </UploadBox>
        {parseSummary && (
          <>
            <StatsContainer>
              <StatLine>
                {rowsAdded > 0 && <StatStatusIcon icon="check" size="regular" />}
                <StatText>
                  Rows added: <StatValue>{rowsAdded}</StatValue>
                </StatText>
              </StatLine>
              <StatLine>
                {rowsFailed > 0 && <StatStatusIcon icon="warning" size="regular" />}
                <StatText>
                  Rows not added: <StatValue>{rowsFailed}</StatValue>
                </StatText>
              </StatLine>
            </StatsContainer>
            {(rowsFailed > 0 || fatalError) && (
              <ErrorList>
                {rowsFailed > 0 && <ErrorLine>{formatFailedRowsMessage(errorRows)}</ErrorLine>}
                {fatalError && <ErrorLine>{fatalError}</ErrorLine>}
              </ErrorList>
            )}
            <TableSection>
              <Table
                items={tableItems}
                columnsState={tableColumns}
                shouldNestItems={false}
                emptyStateComponent={tableEmptyState || undefined}
                style={{ minHeight: "200px", maxHeight: "220px" }}
              />
            </TableSection>
          </>
        )}
        <ProgressContainer>
          {isWorking && <progress style={{ width: "100%", height: `${progressBarHeight}px` }} />}
        </ProgressContainer>
        <ButtonHStack>
          <Button action={handleCancel} keyEquivalent="Escape" isEnabled={!isWorking}>
            Cancel
          </Button>
          {shouldShowReupload && (
            <Button action={handleReupload} keyEquivalent="Enter" isEnabled={!isWorking}>
              Re-upload
            </Button>
          )}
          {!shouldShowReupload && (
            <Button action={handleConfirm} isEnabled={isUploadButtonEnabled} prominence="secondary">
              Upload
            </Button>
          )}
        </ButtonHStack>
      </UploadModalContainer>
    </ModalPanel>
  );
};
UploadCSVModal.displayName = "UploadCSVModal";
