import { parseCSV, requiredValueValidator, uuidValueValidator } from "@/lib/csvUpload";
import type { CSVColumnDefinition, UploadCSVParserResult } from "@/types/csv";

export const METRICS_CSV_COLUMN_DEFINITIONS = [
  { title: "Metric Name", width: 120, validators: [requiredValueValidator] },
  { title: "Metric Question", width: "auto", validators: [requiredValueValidator] },
  { title: "Id", width: 200, validators: [uuidValueValidator] },
  { title: "Input", description: "TRUE or FALSE", width: 60, validators: [requiredValueValidator] },
  { title: "Expected", description: "TRUE or FALSE", width: 60, validators: [requiredValueValidator] },
] as const satisfies readonly CSVColumnDefinition[];

/**
 * Parses and validates metrics CSV content for use with UploadCSVModal.
 * Validates required columns and per-row data, returning detailed error information.
 */
export const parseMetricsCSV = async ({
  contents,
  columnDefinitions,
}: {
  contents: string;
  columnDefinitions: readonly CSVColumnDefinition[];
}): Promise<UploadCSVParserResult> => {
  let result = await parseCSV({
    contents,
    columnDefinitions,
  });

  // Post-processing: Check that at least one of Input or Output is true
  // Note: Papa Parse with dynamicTyping converts "true"/"false" strings to booleans
  result.parsedRows.forEach((row, rowIndex) => {
    if (!row || result.errorRows.has(rowIndex)) return;

    const input = row.Input;
    const output = row.Expected;

    // At least one of Input or Output must be true
    if (input !== true && output !== true) {
      result = result.withErrorRow(rowIndex);
    }
  });

  return result;
};
