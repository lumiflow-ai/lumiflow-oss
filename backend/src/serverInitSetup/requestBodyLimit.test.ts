import { describe, expect, it } from "vitest";

import { MAX_BACKEND_REQUEST_BODY_LIMIT_BYTES, parseRequestBodyLimit } from "./requestBodyLimit";

describe("parseRequestBodyLimit", () => {
  it("parses integer byte values", () => {
    expect(parseRequestBodyLimit("1024")).toBe(1024);
  });

  it("parses unit-suffixed values", () => {
    expect(parseRequestBodyLimit("10mb")).toBe(10 * 1024 * 1024);
    expect(parseRequestBodyLimit("512kb")).toBe(512 * 1024);
    expect(parseRequestBodyLimit("1.5MB")).toBe(1572864);
  });

  it("trims whitespace around values", () => {
    expect(parseRequestBodyLimit("  5mb  ")).toBe(5 * 1024 * 1024);
  });

  it("accepts values at the configured max", () => {
    expect(parseRequestBodyLimit("50mb")).toBe(MAX_BACKEND_REQUEST_BODY_LIMIT_BYTES);
  });

  it("rejects malformed values", () => {
    expect(() => parseRequestBodyLimit("ten megabytes")).toThrow(/Invalid value for BACKEND_REQUEST_BODY_LIMIT/);
    expect(() => parseRequestBodyLimit("12mib")).toThrow(/Invalid value for BACKEND_REQUEST_BODY_LIMIT/);
    expect(() => parseRequestBodyLimit("0mb")).toThrow(/Invalid value for BACKEND_REQUEST_BODY_LIMIT/);
  });

  it("rejects values above the max", () => {
    expect(() => parseRequestBodyLimit("51mb")).toThrow(/Maximum allowed is/);
    expect(() => parseRequestBodyLimit("52428801")).toThrow(/Maximum allowed is/);
  });
});
