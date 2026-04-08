import { describe, expect, it } from "vitest";

import { csvRow, escapeCsvField } from "./csv";

describe("CSV Escaping", () => {
  describe("escapeCsvField", () => {
    it("should return simple strings unchanged", () => {
      expect(escapeCsvField("hello")).toBe("hello");
    });

    it("should wrap fields containing commas", () => {
      expect(escapeCsvField("a,b")).toBe('"a,b"');
    });

    it("should wrap and escape fields containing quotes", () => {
      expect(escapeCsvField('a"b')).toBe('"a""b"');
    });

    it("should wrap fields containing newlines", () => {
      expect(escapeCsvField("a\nb")).toBe('"a\nb"');
    });

    it("should wrap fields containing carriage returns", () => {
      expect(escapeCsvField("a\rb")).toBe('"a\rb"');
    });
  });

  describe("csvRow", () => {
    it("should join simple fields with commas", () => {
      expect(csvRow(["a", "b", "c"])).toBe("a,b,c");
    });

    it("should escape fields that need escaping", () => {
      expect(csvRow(["a,b", "c", 'd"e'])).toBe('"a,b",c,"d""e"');
    });

    it("should handle empty arrays", () => {
      expect(csvRow([])).toBe("");
    });
  });
});
