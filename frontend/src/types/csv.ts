export const CSV_HEADER_ROW_OFFSET = 2; // Account for header row and 1-based indexing

/* Column Definition */

export type CSVColumnDefinition = {
  /** Display title for the column header in the preview table. */
  title: string;
  /** Description or additional information about the column. */
  description?: string;
  /** Optional width override, defaults to "auto". */
  width?: number | "auto";
  /** Optional array of validators to apply to this column's values. */
  validators?: CSVColumnValidator<unknown>[];
};

/* Column Validation */

export type CSVColumnValidatorResult<T> = { value: T } | { error: string };

export type CSVColumnValidator<T> = (args: { columnTitle: string; value: unknown }) => CSVColumnValidatorResult<T>;

/* CSV Parsing */

export class UploadCSVParserResult {
  readonly parsedRows: readonly (Readonly<Record<string, unknown>> | null)[];
  readonly errorRows: ReadonlySet<number>;
  readonly fatalError?: string;

  constructor({
    parsedRows,
    errorRows,
    fatalError,
  }: {
    parsedRows: readonly (Record<string, unknown> | null)[];
    errorRows: ReadonlySet<number>;
    fatalError?: string;
  }) {
    // Validate invariant: errorRows and null parsedRows must match
    for (let i = 0; i < parsedRows.length; i++) {
      const isError = errorRows.has(i);
      const isNull = parsedRows[i] === null;
      if (isError !== isNull) {
        throw new Error(
          `Invariant violation at row ${i}: errorRows.has(${i}) = ${isError} but parsedRows[${i}] is ${isNull ? "null" : "not null"}`,
        );
      }
    }

    // Deep freeze for immutability (copy objects before freezing to avoid modifying originals)
    this.parsedRows = parsedRows.map((row) => (row ? Object.freeze({ ...row }) : null));
    this.errorRows = errorRows;
    this.fatalError = fatalError;
  }

  get validRowCount(): number {
    // Since invariant is enforced (errorRows.has(i) iff parsedRows[i] === null),
    // valid rows are simply non-error rows
    return this.parsedRows.length - this.errorRows.size;
  }

  /**
   * Returns a new UploadCSVParserResult with the specified row marked as an error.
   * Maintains invariant by setting parsedRows[rowIndex] to null.
   * If the row is already an error, returns this instance unchanged.
   */
  withErrorRow(rowIndex: number): UploadCSVParserResult {
    if (this.errorRows.has(rowIndex)) {
      return this;
    }

    const newErrorRows = new Set(this.errorRows);
    newErrorRows.add(rowIndex);

    const newParsedRows = [...this.parsedRows];
    newParsedRows[rowIndex] = null;

    return new UploadCSVParserResult({
      parsedRows: newParsedRows,
      errorRows: newErrorRows,
      fatalError: this.fatalError,
    });
  }
}

export type UploadCSVParser = (args: {
  contents: string;
  columnDefinitions: readonly CSVColumnDefinition[];
}) => Promise<UploadCSVParserResult>;
