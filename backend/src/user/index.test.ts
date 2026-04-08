import { afterEach, describe, expect, it, vi } from "vitest";

import type { OrganizationID } from "@/types";

import {
  domainsWithAdditionalOrgAccess,
  isEmailAllowedForApp,
  OrgIDs,
  resolveOrganizationIDsForEmail,
  WellKnownOrgIDs,
} from "./index";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isEmailAllowedForApp()", () => {
  it("allows any email when no app access allow-list is configured", () => {
    expect(isEmailAllowedForApp("stranger@example.com", { appAccessAllowList: [] })).toBe(true);
  });

  it("allows configured domains", () => {
    expect(isEmailAllowedForApp("developer@example.com", { appAccessAllowList: ["@example.com"] })).toBe(true);
  });

  it("allows configured exact-email entries", () => {
    expect(isEmailAllowedForApp("person@example.com", { appAccessAllowList: ["person@example.com"] })).toBe(true);
  });

  it("rejects emails outside the configured allow-list", () => {
    expect(isEmailAllowedForApp("user@random-company.com", { appAccessAllowList: ["@example.com"] })).toBe(false);
  });

  it("rejects lookalike domains", () => {
    expect(isEmailAllowedForApp("fake@example.com.evil.com", { appAccessAllowList: ["@example.com"] })).toBe(false);
  });

  it("rejects malformed emails with multiple @ symbols", () => {
    expect(isEmailAllowedForApp("attacker@evil.com@example.com", { appAccessAllowList: ["@example.com"] })).toBe(false);
  });

  it("matches allow-list entries case-insensitively", () => {
    expect(isEmailAllowedForApp("Person@Example.com", { appAccessAllowList: ["@example.com"] })).toBe(true);
  });
});

describe("domainsWithAdditionalOrgAccess()", () => {
  it("returns an empty set when no domains are configured", () => {
    vi.stubEnv("ADDITIONAL_ORG_ACCESS_DOMAINS", "");
    expect(domainsWithAdditionalOrgAccess()).toEqual(new Set());
  });

  it("parses configured domains case-insensitively", () => {
    vi.stubEnv("ADDITIONAL_ORG_ACCESS_DOMAINS", "Example.com, example2.com");
    expect(domainsWithAdditionalOrgAccess()).toEqual(new Set(["example.com", "example2.com"]));
  });
});

describe("resolveOrganizationIDsForEmail()", () => {
  const newOrgIdInDb = crypto.randomUUID();
  const sampleDbOrgIDs: OrganizationID[] = [newOrgIdInDb];

  it("returns only database orgs for non-domain users", () => {
    const result = resolveOrganizationIDsForEmail("external@example.com", sampleDbOrgIDs);
    expect(result).toEqual(sampleDbOrgIDs);
  });

  it("adds well-known orgs for allowed domain users", () => {
    vi.stubEnv("ADDITIONAL_ORG_ACCESS_DOMAINS", "example.com");
    const result = resolveOrganizationIDsForEmail("user@example.com", sampleDbOrgIDs);
    expect(result).toContain(OrgIDs.demo.medical); // from db
    expect(result).toEqual(expect.arrayContaining([...WellKnownOrgIDs])); // all well-known orgs
    expect(result.length).toEqual(WellKnownOrgIDs.length + sampleDbOrgIDs.length);
  });

  it("deduplicates when database contains well-known org", () => {
    vi.stubEnv("ADDITIONAL_ORG_ACCESS_DOMAINS", "example.com");
    const dbWithWellKnown: OrganizationID[] = [OrgIDs.demo.medical];
    const result = resolveOrganizationIDsForEmail("user@example.com", dbWithWellKnown);
    const medicalCount = result.filter((id) => id === OrgIDs.demo.medical).length;
    expect(medicalCount).toBe(1);
  });

  it("returns empty for non-domain user with no database orgs", () => {
    vi.stubEnv("ADDITIONAL_ORG_ACCESS_DOMAINS", "example.com");
    expect(resolveOrganizationIDsForEmail("newuser@other-company.com", [])).toEqual([]);
  });

  it("returns well-known orgs for domain user with no database orgs", () => {
    vi.stubEnv("ADDITIONAL_ORG_ACCESS_DOMAINS", "example.com");
    const result = resolveOrganizationIDsForEmail("newuser@example.com", []);
    expect(result).toEqual(expect.arrayContaining([...WellKnownOrgIDs]));
  });

  it("does not grant extra org access to malformed emails", () => {
    vi.stubEnv("ADDITIONAL_ORG_ACCESS_DOMAINS", "example.com");
    expect(resolveOrganizationIDsForEmail("attacker@evil.com@example.com", sampleDbOrgIDs)).toEqual(sampleDbOrgIDs);
  });
});
