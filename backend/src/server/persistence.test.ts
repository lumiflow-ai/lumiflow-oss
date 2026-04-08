import { describe, expect, it } from "vitest";

import { withPGClient, withTransaction } from "@/server/persistence";
import { expectQueryText, fakeClient, fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

describe("Persistence Helpers", () => {
  it("withPGClient() requests and releases a client (manual)", async () => {
    await fakePersistence(async (pgPool) => {
      await withPGClient({ pgPool, logger }, async ({ pgClient }) => {
        expect(pgClient).toBeDefined();
      });
    })
      .expectConnect()
      .expectRelease();
  });

  it("withPGClient() requests and releases a client (expectClient)", async () => {
    await fakePersistence(async (pgPool) => {
      await withPGClient({ pgPool, logger }, async ({ pgClient }) => {
        expect(pgClient).toBeDefined();
      });
    }).expectClient();
  });

  it("withPGClient() allows queries to run (handler)", async () => {
    await fakePersistence(async (pgPool) => {
      await withPGClient({ pgPool, logger }, async ({ pgClient }) => {
        await pgClient.query("SELECT");
      });
    }).expectClient((tester) => {
      tester.expectQuery(({ text }) => {
        expectQueryText(text).toMatch("SELECT;");
      });
    });
  });

  it("withPGClient() allows queries to run (fakeClient)", async () => {
    await fakePersistence(async (pgPool) => {
      await withPGClient({ pgPool, logger }, async ({ pgClient }) => {
        await pgClient.query("SELECT");
      });
    }).expectClient(
      fakeClient.expectQuery(({ text }) => {
        expectQueryText(text).toMatch("SELECT;");
      }),
    );
  });

  it("withTransaction() commits (handler)", async () => {
    await fakePersistence(async (pgPool) => {
      await withPGClient({ pgPool, logger }, async (context) => {
        await withTransaction(context, async ({ pgClient }) => {
          await pgClient.query("SELECT");
        });
      });
    }).expectClient((tester) => {
      tester.expectTransaction((tester) => {
        tester.expectQuery(({ text }) => {
          expectQueryText(text).toMatch("SELECT;");
        });
      });
    });
  });

  it("withTransaction() commits (fakeClient)", async () => {
    await fakePersistence(async (pgPool) => {
      await withPGClient({ pgPool, logger }, async (context) => {
        await withTransaction(context, async ({ pgClient }) => {
          await pgClient.query("SELECT");
        });
      });
    }).expectClient(
      fakeClient.expectTransaction(
        fakeClient.expectQuery(({ text }) => {
          expectQueryText(text).toMatch("SELECT;");
        }),
      ),
    );
  });
});
