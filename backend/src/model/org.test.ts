import { describe, expect, it } from "vitest";

import { withPGClient } from "@/server/persistence";
import { expectQueryText, fakeClient, fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

import { PGOrgManager } from "@/model/org";

describe("PGOrgManager SQL Snapshots", () => {
  it("createOrganization() inserts under org ID", async () => {
    await fakePersistence(async (pgPool) => {
      await withPGClient({ pgPool, logger }, async (context) => {
        const result = await PGOrgManager.createOrganization({
          organization: { id: "TestID", name: "Org Name" },
          context,
        });
        expect(result).toEqual({ id: "TestID", name: "Org Name" });
      });
    }).expectClient(
      fakeClient.expectQuery((query) => {
        expectQueryText(query.text).toMatch(`
          INSERT INTO public.organizations (
            "id",
            "updated_at",
            "organization"
          ) VALUES (
            $1,
            now(),
            $2
          )
          ON CONFLICT ("id") DO UPDATE
            SET
              "updated_at" = excluded."updated_at",
              "organization" = excluded."organization";
        `);
        expect(query.values).toEqual(["TestID", { id: "TestID", name: "Org Name" }]);
      }),
    );
  });

  describe("fetchOrganizationByID()", () => {
    it("returns org when found", async () => {
      await fakePersistence(async (pgPool) => {
        await withPGClient({ pgPool, logger }, async (context) => {
          const result = await PGOrgManager.fetchOrganizationByID({ orgID: "TestID", context });
          expect(result).toEqual({ id: "TestID", name: "Org Name" });
        });
      }).expectClient(
        fakeClient.expectQuery((query) => {
          expectQueryText(query.text).toMatch(`
            SELECT "organization"
              FROM public.organizations
              WHERE "id" = $1
              LIMIT 1;
          `);
          expect(query.values).toEqual(["TestID"]);
          return { rows: [{ organization: { id: "TestID", name: "Org Name" } }] };
        }),
      );
    });

    it("returns null when missing", async () => {
      await fakePersistence(async (pgPool) => {
        await withPGClient({ pgPool, logger }, async (context) => {
          const result = await PGOrgManager.fetchOrganizationByID({ orgID: "TestID", context });
          expect(result).toBeNull();
        });
      }).expectClient(
        fakeClient.expectQuery((query) => {
          expectQueryText(query.text).toMatch(`
            SELECT "organization"
              FROM public.organizations
              WHERE "id" = $1
              LIMIT 1;
          `);
          expect(query.values).toEqual(["TestID"]);
          return { rows: [] };
        }),
      );
    });
  });

  it("fetchAllOrganizations() returns all orgs", async () => {
    await fakePersistence(async (pgPool) => {
      await withPGClient({ pgPool, logger }, async (context) => {
        const result = await PGOrgManager.fetchAllOrganizations({
          context,
        });
        expect(result).toEqual([
          { id: "TestID1", name: "Org Name 1" },
          { id: "TestID2", name: "Org Name 2" },
        ]);
      });
    }).expectClient(
      fakeClient.expectQuery((query) => {
        expectQueryText(query.text).toMatch(`
          SELECT "organization"
            FROM public.organizations
            WHERE organization->>'isDeleted' IS NULL OR organization->>'isDeleted' != 'true'
            ORDER BY "updated_at" DESC;
        `);
        expect(query.values).toBeUndefined();
        return {
          rows: [
            { organization: { id: "TestID1", name: "Org Name 1" } },
            { organization: { id: "TestID2", name: "Org Name 2" } },
          ],
        };
      }),
    );
  });
});
