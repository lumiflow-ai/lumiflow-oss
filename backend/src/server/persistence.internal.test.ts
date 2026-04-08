import { describe, expect, it } from "vitest";

import { normalizeQueryText } from "@/server/persistence.internal";

describe("Internal Persistence Testers", () => {
  it("normalizeQueryText() normalizes", () => {
    expect(normalizeQueryText("")).toEqual(";");
    expect(normalizeQueryText("    ")).toEqual(";");
    expect(normalizeQueryText(";;;;;;")).toEqual(";");
    expect(normalizeQueryText("  ;  ;  ;  ;  ;  ;")).toEqual(";");
    expect(normalizeQueryText("BEGIN TRANSACTION;")).toEqual("BEGIN TRANSACTION;");
    expect(normalizeQueryText("   BEGIN   TRANSACTION      ")).toEqual("BEGIN TRANSACTION;");
    expect(normalizeQueryText("   BEGIN   TRANSACTION   ;   ")).toEqual("BEGIN TRANSACTION;");
    expect(
      normalizeQueryText(`
      BEGIN
        TRANSACTION;
    `),
    ).toEqual("BEGIN TRANSACTION;");
    expect(
      normalizeQueryText(`
      BEGIN
        TRANSACTION
    `),
    ).toEqual("BEGIN TRANSACTION;");
  });
});
