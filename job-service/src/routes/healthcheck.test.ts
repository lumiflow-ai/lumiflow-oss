import type pg from "pg";
import supertest from "supertest";
import { describe, it } from "vitest";

import { logger } from "@/server/logger";

import { createApp } from "@/app";

describe("Healthcheck Route", () => {
  it("/helthcheck returns ok", async () => {
    const pgPool = {
      query() {
        throw new Error("Should never get here.");
      },
      connect() {
        return {
          query() {
            throw new Error("Should never get here.");
          },
          release() {},
        };
      },
    } as unknown as pg.Pool;
    const app = createApp({ logger, pgPool });
    await supertest(app).get("/healthcheck").expect(200).expect("OK");
  });
});
