import Papa from "papaparse";

import {
  type CSVColumnDefinition,
  type CSVColumnValidator,
  type CSVColumnValidatorResult,
  UploadCSVParserResult,
} from "@/types/csv";

const PAPA_PARSE_OPTIONS: Papa.ParseConfig<Record<string, unknown>> = {
  header: true,
  skipEmptyLines: "greedy",
  dynamicTyping: true,
};

/* Helpers */

const isEmptyValue = (value: unknown) => {
  if (value == null) return true;
  if (typeof value === "string") return value === "";
  return false;
};

/* Date Bounds
 *
 * Dates in CSV uploads must be within reasonable bounds:
 * - Not older than 3 years ago
 * - Not more than 24 hours in the future
 *
 * When a date is missing a year (e.g., "Nov 2"), Date.parse defaults to 2001.
 * We fix this by inferring the latest valid year within bounds.
 */

const DATE_BOUNDS = {
  maxAgeYears: 3,
  maxFutureHours: 24,
};

/** Returns true if date is within allowed bounds (not too old, not too far in future). */
function isDateWithinBounds(date: Date, now: Date = new Date()): boolean {
  const oldestAllowed = new Date(now);
  oldestAllowed.setFullYear(oldestAllowed.getFullYear() - DATE_BOUNDS.maxAgeYears);

  const maxFuture = new Date(now);
  maxFuture.setHours(maxFuture.getHours() + DATE_BOUNDS.maxFutureHours);

  return date >= oldestAllowed && date <= maxFuture;
}

/** Tries years from current year backwards to find one that puts the date within bounds. Returns null if none work. */
function inferYearForDate(date: Date, now: Date = new Date()): Date | null {
  const currentYear = now.getFullYear();
  for (let year = currentYear; year >= currentYear - DATE_BOUNDS.maxAgeYears; year--) {
    const candidate = new Date(date);
    candidate.setFullYear(year);
    if (isDateWithinBounds(candidate, now)) {
      return candidate;
    }
  }
  return null;
}

/** Returns true if the string appears to contain an explicit year (2 or 4 digits). */
function hasExplicitYear(value: string): boolean {
  // Match 4-digit year or 2-digit year (as standalone number, not part of day like "Nov 02")
  // 4-digit: \b\d{4}\b
  // 2-digit year typically appears after a separator: /24, -24, or at end like "Nov 2 24"
  return /\b\d{4}\b/.test(value) || /[/-]\d{2}\b/.test(value) || /\s\d{2}$/.test(value);
}

/** Parses a date string and ensures it's within bounds. Infers the year only if not explicitly provided. Returns null if unparseable or out of bounds. */
function parseDateWithBounds(value: string, now: Date = new Date()): Date | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const date = new Date(timestamp);

  if (isDateWithinBounds(date, now)) {
    return date;
  }

  // Only infer year if one wasn't explicitly provided
  if (hasExplicitYear(value)) {
    return null;
  }

  return inferYearForDate(date, now);
}

/* Validators */

export const requiredValueValidator: CSVColumnValidator<unknown> = ({ value, columnTitle }) => {
  if (isEmptyValue(value)) {
    return { error: `Missing ${columnTitle}` };
  }
  return { value };
};

export const timestampISOValueValidator: CSVColumnValidator<string | null> = ({ value, columnTitle }) => {
  if (isEmptyValue(value)) {
    return { value: null };
  }
  const normalized = String(value).trim();
  const date = parseDateWithBounds(normalized);
  if (!date) {
    return { error: `${columnTitle} not a valid timestamp (must be within the last 3 years)` };
  }
  return { value: date.toISOString() };
};
const isBlankValue = (value: unknown): boolean => {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
};

export const uuidValueValidator: CSVColumnValidator<string | undefined> = ({ value, columnTitle }) => {
  if (isBlankValue(value)) {
    return { value: undefined };
  }
  if (typeof value !== "string") {
    return { error: `${columnTitle} must be a string or empty` };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: undefined };
  }
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(trimmed)) {
    return { error: `${columnTitle} must be a valid UUID` };
  }
  return { value: trimmed };
};

/* Parsing Logic */

const parseContents = (
  contents: string,
): {
  result: Papa.ParseResult<Record<string, unknown>>;
  parsedRows: Array<Record<string, unknown> | null>;
  errorRows: Set<number>;
} => {
  const result = Papa.parse<Record<string, unknown>>(contents, PAPA_PARSE_OPTIONS);
  return {
    result,
    parsedRows: result.data.map((row) =>
      row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : null,
    ),
    errorRows: new Set(
      result.errors.filter((error) => typeof error.row === "number").map((error) => error.row as number),
    ),
  };
};

const validateColumn = ({
  columnTitle,
  validators,
  initialValue,
}: {
  columnTitle: string;
  validators: CSVColumnValidator<unknown>[];
  initialValue: unknown;
}): CSVColumnValidatorResult<unknown> => {
  if (!validators || validators.length === 0) return { value: initialValue };

  let value: unknown = initialValue;
  let error: string | null = null;

  for (const validator of validators) {
    const result = validator({ columnTitle, value });
    if ("error" in result) {
      error = result.error;
      break;
    }
    value = result.value;
  }
  return error ? { error } : { value };
};

export const parseCSV = async ({
  contents,
  columnDefinitions,
}: {
  contents: string;
  columnDefinitions: readonly CSVColumnDefinition[];
}): Promise<UploadCSVParserResult> => {
  let fatalError: string | undefined;

  // Parse contents
  const { result, parsedRows: rows, errorRows } = parseContents(contents);

  // Validate header row
  const headerFields = (result.meta.fields ?? []).map((field) => (typeof field === "string" ? field.trim() : ""));
  const missingColumnTitles = columnDefinitions
    .filter((def) => def.validators?.includes(requiredValueValidator))
    .map((def) => def.title)
    .filter((title) => !headerFields.includes(title));

  if (headerFields.length === 0) {
    fatalError = "Missing header row";
  } else if (missingColumnTitles.length > 0) {
    fatalError = `Missing required columns: ${missingColumnTitles.join(", ")}`;
  }

  // Parse rows
  const parsedRows = rows.map((row, rowIndex) => {
    // Report rows that failed to parse
    if (!row) {
      errorRows.add(rowIndex);
      return null;
    }

    // Report empty rows
    const rowValues = Object.values(row);
    if (rowValues.length === 0 || rowValues.every((value) => isEmptyValue(value))) {
      errorRows.add(rowIndex);
      return null;
    }

    // Parse rows and report those that failed validation
    for (const columnDef of columnDefinitions) {
      const result = validateColumn({
        columnTitle: columnDef.title,
        validators: columnDef.validators || [],
        initialValue: row[columnDef.title],
      });

      // Report validation errors
      if ("error" in result) {
        errorRows.add(rowIndex);
        return null;
      }

      // Set validated value
      row[columnDef.title] = result.value;
    }
    return row;
  });

  return new UploadCSVParserResult({
    parsedRows,
    errorRows,
    fatalError,
  });
};
