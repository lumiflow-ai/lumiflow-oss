import { describe, expect, it } from "vitest";

import { METRICS_CSV_COLUMN_DEFINITIONS, parseMetricsCSV } from "@/model/metricsCsvTransform";

const uuid1 = "f2ed112f-105c-481b-8f7d-0cfa8bc920be";
const uuid2 = "9d966820-6d04-4e54-8f84-2d68e2809e23";
const uuid3 = "1763b128-3bd2-4218-be8a-99415b664f64";

const columnMetricName = METRICS_CSV_COLUMN_DEFINITIONS[0].title;
const columnMetricQuestion = METRICS_CSV_COLUMN_DEFINITIONS[1].title;
const columnId = METRICS_CSV_COLUMN_DEFINITIONS[2].title;
const columnInput = METRICS_CSV_COLUMN_DEFINITIONS[3].title;
const columnOutput = METRICS_CSV_COLUMN_DEFINITIONS[4].title;

const csvHeader = `${columnMetricName},${columnMetricQuestion},${columnId},${columnInput},${columnOutput}`;

describe("parseMetricsCSV", () => {
  it("should parse valid CSV data with both input and output", async () => {
    const metricName = "Test Metric";
    const metricQuestion = "Is this a test?";
    const csv = `${csvHeader}
${metricName},${metricQuestion},${uuid1},true,true`;

    const result = await parseMetricsCSV({ contents: csv, columnDefinitions: METRICS_CSV_COLUMN_DEFINITIONS });

    expect(result.fatalError).toBeUndefined();
    expect(result.errorRows.size).toBe(0);
    expect(result.parsedRows).toHaveLength(1);
    expect(result.parsedRows[0]).toEqual({
      [columnMetricName]: metricName,
      [columnMetricQuestion]: metricQuestion,
      [columnId]: uuid1,
      [columnInput]: true,
      [columnOutput]: true,
    });
  });

  it("should parse CSV with only input", async () => {
    const metricName = "Input Only";
    const metricQuestion = "Does the text contain 'a'?";
    const csv = `${csvHeader}
${metricName},${metricQuestion},${uuid2},true,false`;

    const result = await parseMetricsCSV({ contents: csv, columnDefinitions: METRICS_CSV_COLUMN_DEFINITIONS });

    expect(result.validRowCount).toBe(1);
    expect(result.errorRows.size).toBe(0);
    expect(result.parsedRows[0]?.[columnInput]).toBe(true);
    expect(result.parsedRows[0]?.[columnOutput]).toBe(false);
  });

  it("should parse CSV with only output", async () => {
    const metricName = "Output Only";
    const metricQuestion = 'Does the text contain "a"?';
    const csv = `${csvHeader}
${metricName},${metricQuestion},${uuid3},false,true`;

    const result = await parseMetricsCSV({ contents: csv, columnDefinitions: METRICS_CSV_COLUMN_DEFINITIONS });

    expect(result.validRowCount).toBe(1);
    expect(result.errorRows.size).toBe(0);
    expect(result.parsedRows[0]?.[columnInput]).toBe(false);
    expect(result.parsedRows[0]?.[columnOutput]).toBe(true);
  });

  it("should handle multiple valid rows", async () => {
    const csv = `${csvHeader}
Metric 1,Question 1,${uuid1},true,false
Metric 2,Question 2,${uuid2},false,true`;

    const result = await parseMetricsCSV({ contents: csv, columnDefinitions: METRICS_CSV_COLUMN_DEFINITIONS });

    expect(result.validRowCount).toBe(2);
    expect(result.errorRows.size).toBe(0);
    expect(result.parsedRows).toHaveLength(2);
  });

  it("should handle missing optional Id column", async () => {
    const csv = `${csvHeader}
Test,Question,,true,false`;

    const result = await parseMetricsCSV({ contents: csv, columnDefinitions: METRICS_CSV_COLUMN_DEFINITIONS });

    expect(result.validRowCount).toBe(1);
    expect(result.errorRows.size).toBe(0);
    // Validator transforms empty string to undefined
    expect(result.parsedRows[0]?.[columnId]).toBeUndefined();
  });

  it("should handle missing required columns", async () => {
    const csv = `${columnMetricName},${columnInput},${columnOutput}
Test,true,false`;

    const result = await parseMetricsCSV({ contents: csv, columnDefinitions: METRICS_CSV_COLUMN_DEFINITIONS });

    expect(result.fatalError).toContain("Missing required column");
    expect(result.fatalError).toContain(columnMetricQuestion);
  });

  it("should detect invalid UUID format", async () => {
    const invalidUuid = "invalid-uuid";
    const csv = `${csvHeader}
Test,Question,${invalidUuid},true,false`;

    const result = await parseMetricsCSV({ contents: csv, columnDefinitions: METRICS_CSV_COLUMN_DEFINITIONS });

    expect(result.validRowCount).toBe(0);
    expect(result.errorRows.size).toBe(1);
    expect(result.errorRows.has(0)).toBe(true);
  });

  it("should detect invalid boolean values", async () => {
    const csv = `${csvHeader}
Test,Question,${uuid1},yes,no`;

    const result = await parseMetricsCSV({ contents: csv, columnDefinitions: METRICS_CSV_COLUMN_DEFINITIONS });

    expect(result.validRowCount).toBe(0);
    expect(result.errorRows.size).toBe(1);
    expect(result.errorRows.has(0)).toBe(true);
  });

  it("should reject when both input and output are false", async () => {
    const csv = `${csvHeader}
Test,Question,${uuid1},false,false`;

    const result = await parseMetricsCSV({ contents: csv, columnDefinitions: METRICS_CSV_COLUMN_DEFINITIONS });

    expect(result.validRowCount).toBe(0);
    expect(result.errorRows.size).toBe(1);
    expect(result.errorRows.has(0)).toBe(true);
  });

  it("should detect empty required string fields", async () => {
    const csv = `${csvHeader}
,Question,${uuid1},true,false`;

    const result = await parseMetricsCSV({ contents: csv, columnDefinitions: METRICS_CSV_COLUMN_DEFINITIONS });

    expect(result.validRowCount).toBe(0);
    expect(result.errorRows.size).toBe(1);
    expect(result.errorRows.has(0)).toBe(true);
  });

  it("should trim whitespace from UUID values but reject whitespace around booleans", async () => {
    const metricName = "Test Metric";
    const metricQuestion = "Question?";
    // CSV with leading/trailing whitespace in UUID (should work) but whitespace around booleans (should fail)
    const csv = `${csvHeader}
${metricName},${metricQuestion},  ${uuid1}  ,  true  ,  false  `;

    const result = await parseMetricsCSV({ contents: csv, columnDefinitions: METRICS_CSV_COLUMN_DEFINITIONS });

    // Boolean values with whitespace are not converted by Papa Parse, causing validation failure
    expect(result.validRowCount).toBe(0);
    expect(result.errorRows.size).toBe(1);
    expect(result.errorRows.has(0)).toBe(true);
  });

  it("should continue processing after encountering errors", async () => {
    const invalidUuid = "not-a-uuid";
    const csv = `${csvHeader}
Valid,Question,${uuid1},true,false
Invalid,Question,${invalidUuid},true,false
Also Valid,Question,${uuid2},false,true`;

    const result = await parseMetricsCSV({ contents: csv, columnDefinitions: METRICS_CSV_COLUMN_DEFINITIONS });

    expect(result.validRowCount).toBe(2);
    expect(result.errorRows.size).toBe(1);
    expect(result.errorRows.has(1)).toBe(true);
    expect(result.parsedRows[0]?.[columnMetricName]).toBe("Valid");
    expect(result.parsedRows[2]?.[columnMetricName]).toBe("Also Valid");
  });

  it("should handle missing header row", async () => {
    const csv = "";

    const result = await parseMetricsCSV({ contents: csv, columnDefinitions: METRICS_CSV_COLUMN_DEFINITIONS });

    expect(result.fatalError).toContain("Missing header row");
  });
});
