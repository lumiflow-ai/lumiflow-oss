import supertest from "supertest";
import { describe, expect, it } from "vitest";

import { OrganizationTemplate } from "@/types";

import { expectQueryText, fakeClient, fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

import { ProductionAuthorizationManager } from "@/lib/authorization";
import {
  deriveFakeUserSessionFromSessionCookie,
  FakeAuthorizationManager,
  FakeAuthorizationResults,
} from "@/lib/authorization.internal";

import type { Managers } from "@/model/managers";
import { FakeOrgManager } from "@/model/org.internal";
import { FakeUserManager, FakeUsers } from "@/model/user.internal";

import { createApp } from "@/app";
import { TemplateOrgIDs } from "@/user";

import { CreateOrganizationResponseSchema } from "./definitions";

describe("Load Orgs Route", () => {
  it("post /v0.1/orgs creates a new org", async () => {
    await fakePersistence(async (pgPool) => {
      const orgManager = new FakeOrgManager();
      const userManager = new FakeUserManager();
      await userManager.createUser({ user: FakeUsers.newUser });
      const app = createApp({
        managers: { org: orgManager, user: userManager },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validNewUserSession),
        pgPool,
        logger,
      });
      const response = await supertest(app).post("/v0.1/orgs").send({ name: "Test" }).expect(200);

      const orgResponse = CreateOrganizationResponseSchema.parse(response.body);
      expect(orgResponse.organization.name).equals("Test");
      expect(orgResponse.organization.id).to.be.a("string");
      expect(orgResponse.organization.template).to.equal(OrganizationTemplate.general);
      expect(orgManager.organizations.has(orgResponse.organization.id)).to.be.true;

      const updatedUser = await userManager.fetchUserByID({ userID: FakeUsers.newUser.id });
      expect(updatedUser).to.not.be.null;
      expect(updatedUser?.id).to.equal(FakeUsers.newUser.id);
      expect(updatedUser?.fullName).to.equal(FakeUsers.newUser.fullName);
      expect(updatedUser?.organizationIDs).to.include(orgResponse.organization.id);
    }).expectClient(
      fakeClient.expectTransaction(
        fakeClient
          .expectQuery(({ text, values }) => {
            /// Metric Definitions.
            expectQueryText(text).toMatch(`SELECT * FROM public.metric_definitions WHERE "org_id" = $1;`);
            expect(values).toEqual([TemplateOrgIDs.general]);
            /// Return no objects so we don't actually migrate anything, as this is tested elsewhere.
            return { rows: [], rowCount: 0 };
          })
          .expectQuery(() => {
            /// Return no objects so we don't actually migrate anything, as this is tested elsewhere.
            return { rows: [], rowCount: 0 };
          })
          .expectQuery(({ text, values }) => {
            /// Artifact Snapshots.
            expectQueryText(text).toMatch(`
              SELECT
                "artifact_path",
                "event_summary_id",
                "timestamp",
                "snapshot"
              FROM public.artifact_snapshots
              WHERE "org_id" = $1;
            `);
            expect(values).toEqual([TemplateOrgIDs.general]);
            /// Return no objects so we don't actually migrate anything, as this is tested elsewhere.
            return { rows: [], rowCount: 0 };
          }),
      ),
    );
  });

  it("post /v0.1/orgs returns unauthorized when no auth is present", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        authorization: new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie),
        pgPool,
        logger,
        managers: {} as Managers,
      });
      await supertest(app)
        .post("/v0.1/orgs")
        .expect(401)
        .expect((response) => {
          expect(response.body.type).equals("error");
          expect(response.body.reason).equals("Authentication Error");
          expect(response.body.error.message).equals("Session Not Found");
        });
    });
  });
});
