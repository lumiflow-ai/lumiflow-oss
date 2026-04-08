import { describe, expect, it } from "vitest";

import { parseCSV, requiredValueValidator, timestampISOValueValidator, uuidValueValidator } from "./csvUpload";

describe("requiredValueValidator", () => {
  it("returns an error when the value is empty", () => {
    expect(requiredValueValidator({ value: "", columnTitle: "Name" })).toEqual({ error: "Missing Name" });
    expect(requiredValueValidator({ value: null, columnTitle: "Name" })).toEqual({ error: "Missing Name" });
  });

  it("passes through non-empty values", () => {
    expect(requiredValueValidator({ value: "Alice", columnTitle: "Name" })).toEqual({ value: "Alice" });
    expect(requiredValueValidator({ value: "   ", columnTitle: "Name" })).toEqual({ value: "   " });
  });
});

describe("timestampISOValueValidator", () => {
  const MAX_AGE_YEARS = 3;
  const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

  it("returns null for blank input", () => {
    expect(timestampISOValueValidator({ value: "", columnTitle: "Timestamp" })).toEqual({ value: null });
  });

  it("parses valid ISO timestamps within bounds", () => {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const timestamp = oneMonthAgo.toISOString();

    const result = timestampISOValueValidator({ value: timestamp, columnTitle: "Timestamp" });
    if (!("value" in result)) throw new Error("Expected validator to return a value");
    expect(result.value).toBe(timestamp);
  });

  it("infers year for dates without year (e.g., 'Nov 2')", () => {
    const result = timestampISOValueValidator({ value: "Nov 2", columnTitle: "Timestamp" });
    if (!("value" in result)) throw new Error("Expected validator to return a value");

    const date = new Date(result.value as string);
    const now = new Date();

    // Expected year: latest year where Nov 2 is within bounds
    let expectedYear = now.getFullYear();
    const nov2ThisYear = new Date(Date.UTC(expectedYear, 10, 2));
    if (nov2ThisYear.getTime() > now.getTime() + MAX_FUTURE_MS) {
      expectedYear--;
    }

    expect(date.getUTCMonth()).toBe(10); // November
    expect(date.getUTCDate()).toBe(2);
    expect(date.getUTCFullYear()).toBe(expectedYear);
  });

  it("returns an error for unparseable timestamps", () => {
    const result = timestampISOValueValidator({ value: "not-a-timestamp", columnTitle: "Timestamp" });
    expect(result).toHaveProperty("error");
  });

  it("returns an error for timestamps with explicit year older than 3 years", () => {
    const now = new Date();
    const tooOld = new Date(now);
    tooOld.setFullYear(tooOld.getFullYear() - MAX_AGE_YEARS - 1);

    const result = timestampISOValueValidator({ value: tooOld.toISOString(), columnTitle: "Timestamp" });
    expect(result).toHaveProperty("error");
  });

  it("returns an error for timestamps with explicit year more than 24 hours in the future", () => {
    const now = new Date();
    const tooFuture = new Date(now);
    tooFuture.setFullYear(tooFuture.getFullYear() + 1);

    const result = timestampISOValueValidator({ value: tooFuture.toISOString(), columnTitle: "Timestamp" });
    expect(result).toHaveProperty("error");
  });

  it("returns an error for dates with explicit 2-digit year out of bounds", () => {
    // "1/15/90" has explicit 2-digit year, should not infer
    const result = timestampISOValueValidator({ value: "1/15/90", columnTitle: "Timestamp" });
    expect(result).toHaveProperty("error");
  });
});

describe("parseCSV", () => {
  it("parses rows using the header row, converts primitives, and skips empty lines", async () => {
    const contents = ["Name,Score,Active", "Alice,42,true", "    ", "Bob,3,false"].join("\n");

    const result = await parseCSV({
      contents,
      columnDefinitions: [
        { title: "Name", validators: [requiredValueValidator] },
        { title: "Score" },
        { title: "Active" },
      ],
    });

    expect(result.fatalError).toBeUndefined();
    expect(result.errorRows.size).toBe(0);
    expect(result.parsedRows).toEqual([
      { Name: "Alice", Score: 42, Active: true },
      { Name: "Bob", Score: 3, Active: false },
    ]);
  });

  it("flags a fatal error when the header row is missing", async () => {
    const result = await parseCSV({ contents: "", columnDefinitions: [{ title: "Name" }] });
    expect(result.fatalError).toBe("Missing header row");
    expect(result.errorRows.size).toBe(0);
    expect(result.parsedRows).toEqual([]);
  });

  it("reports missing required column titles", async () => {
    const contents = ["Name", "Alice"].join("\n");
    const result = await parseCSV({
      contents,
      columnDefinitions: [
        { title: "Name", validators: [requiredValueValidator] },
        { title: "Start Date", validators: [requiredValueValidator] },
        { title: "Score", validators: [requiredValueValidator] },
      ],
    });
    expect(result.fatalError).toBe("Missing required columns: Start Date, Score");
  });

  it("allows missing headers for optional columns without requiredValueValidator", async () => {
    const contents = ["Name,Score", "Alice,42", "Bob,99"].join("\n");
    const result = await parseCSV({
      contents,
      columnDefinitions: [
        { title: "Name", validators: [requiredValueValidator] },
        { title: "Score", validators: [requiredValueValidator] },
        { title: "Id", validators: [uuidValueValidator] }, // Optional column
        { title: "Notes" }, // Optional column with no validators
      ],
    });

    expect(result.fatalError).toBeUndefined();
    expect(result.errorRows.size).toBe(0);
    expect(result.parsedRows).toEqual([
      { Name: "Alice", Score: 42, Id: undefined, Notes: undefined },
      { Name: "Bob", Score: 99, Id: undefined, Notes: undefined },
    ]);
  });

  it("parses rows, applies validators, and marks invalid rows", async () => {
    // Use a recent date that's within the 3-year bounds
    const now = new Date();
    const recentDate = new Date(now);
    recentDate.setMonth(recentDate.getMonth() - 1);
    const recentDateStr = recentDate.toISOString().split("T")[0];
    const expectedISO = `${recentDateStr}T00:00:00.000Z`;

    const contents = [
      "Name,Timestamp,Notes", // header
      `Alice,${recentDateStr},Ready`, // 0
      `,${recentDateStr},Missing name`, // 1
      "Charlie,not-a-date,Invalid date", // 2
      "Bob,,Optional timestamp", // 3
    ].join("\n");

    const { parsedRows, errorRows, fatalError } = await parseCSV({
      contents,
      columnDefinitions: [
        { title: "Name", validators: [requiredValueValidator] },
        { title: "Timestamp", validators: [timestampISOValueValidator] },
        { title: "Notes" },
      ],
    });

    expect(fatalError).toBeUndefined();
    expect(parsedRows).toHaveLength(4);

    // 0: Valid row
    const aliceRow = parsedRows[0] as Record<string, unknown>;
    expect(aliceRow.Name).toBe("Alice");
    expect(aliceRow.Timestamp).toBe(expectedISO);

    // 1: Invalid row, missing name
    expect(parsedRows[1]).toBeNull();

    // 2: Invalid row, invalid date
    expect(parsedRows[2]).toBeNull();

    // 3: Valid row with optional timestamp missing
    const bobRow = parsedRows[3] as Record<string, unknown>;
    expect(bobRow.Name).toBe("Bob");
    expect(bobRow.Timestamp).toBeNull();

    const sortedErrorRows = Array.from(errorRows).sort((a, b) => a - b);
    expect(sortedErrorRows).toEqual([1, 2]);
  });
});

describe("uuidValueValidator", () => {
  const uuid = "f2ed112f-105c-481b-8f7d-0cfa8bc920be";
  const columnTitle = "Id";

  it("should accept valid UUID", () => {
    const result = uuidValueValidator({ value: uuid, columnTitle });
    expect(result).toEqual({ value: uuid });
  });

  it("should accept empty string as undefined", () => {
    const result = uuidValueValidator({ value: "", columnTitle });
    expect(result).toEqual({ value: undefined });
  });

  it("should accept whitespace-only string as undefined", () => {
    const result = uuidValueValidator({ value: "   ", columnTitle });
    expect(result).toEqual({ value: undefined });
  });

  it("should accept null as undefined", () => {
    const result = uuidValueValidator({ value: null, columnTitle });
    expect(result).toEqual({ value: undefined });
  });

  it("should accept undefined as undefined", () => {
    const result = uuidValueValidator({ value: undefined, columnTitle });
    expect(result).toEqual({ value: undefined });
  });

  it("should reject invalid UUID format", () => {
    const invalidUuid = "not-a-uuid";
    const result = uuidValueValidator({ value: invalidUuid, columnTitle });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("valid UUID");
  });

  it("should trim whitespace from valid UUID", () => {
    const result = uuidValueValidator({ value: `  ${uuid}  `, columnTitle });
    expect(result).toEqual({ value: uuid });
  });

  it("should reject non-string values", () => {
    const result = uuidValueValidator({ value: 123, columnTitle });
    expect(result).toHaveProperty("error");
  });
});
