import supertest from "supertest";
import { describe, expect, it } from "vitest";

import { fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

import { FakeAuthorizationManager, FakeAuthorizationResults } from "@/lib/authorization.internal";

import { FakeOrganizations, FakeOrgManager } from "@/model/org.internal";
import { FakeUserManager } from "@/model/user.internal";

import { createApp } from "@/app";
import { OrgIDs } from "@/user";

describe("Load Default Route", () => {
  it("get /v0.1/dashboards/default returns hard-coded medical configuration for medical templates", async () => {
    await fakePersistence(async (pgPool) => {
      const orgManager = new FakeOrgManager();
      const userManager = new FakeUserManager();
      const app = createApp({
        managers: { org: orgManager, user: userManager },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });
      const result = await supertest(app)
        .get(`/v0.1/dashboards/default?orgID=${FakeOrganizations.medical.id}&context=list&patterns[0][0][kind]=dataset`)
        .expect(200);

      expect(result.body?.dashboard.id).to.be.not.false;
      expect(result.body?.dashboard.widgets).to.be.an("array").that.is.not.empty;
    });
  });

  it("get /v0.1/dashboards/default returns configured dashboard for non-medical orgs", async () => {
    await fakePersistence(async (pgPool) => {
      const orgManager = new FakeOrgManager();
      const userManager = new FakeUserManager();
      const app = createApp({
        managers: { org: orgManager, user: userManager },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMigratedUserSession),
        pgPool,
        logger,
      });
      const orgID = OrgIDs.testData;
      const result = await supertest(app)
        .get(`/v0.1/dashboards/default?orgID=${orgID}&context=list&patterns[0][0][kind]=project`)
        .expect(200);

      expect(result.body?.dashboard.widgets).to.be.an("array").that.is.not.empty;
      const firstWidget = result.body?.dashboard.widgets?.[0];
      expect(firstWidget?.kind).to.equal("table");
      expect(firstWidget?.columns?.[1]?.title).to.equal("Artifacts");
    });
  });
});
