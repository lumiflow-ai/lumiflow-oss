import type { ArtifactPath } from "@/types";

import { createPGClient } from "@/server/persistence";

type StoredMetricRecord = {
  type: string;
  values: { eventID: string; value: number }[];
};

type StoredArtifactMetrics = {
  id: ArtifactPath;
  parentID: ArtifactPath | null;
  creationTime: Date;
  modificationTime: Date;
  metrics: StoredMetricRecord[];
  outcomes: StoredMetricRecord[];
};

// Run with `% npm run seed:metrics`
// Run with `% npm run seed:metrics -- --reset`
// Run with `% npm run seed:metrics -- --delete`

const ARTIFACT_COUNT = 10000;
const START_TIME = new Date("2023-09-01T00:00:00.000Z");
const END_TIME = new Date("2024-09-01T00:00:00.000Z");
const TIME_DISTANCE = (END_TIME.getTime() - START_TIME.getTime()) / ARTIFACT_COUNT;

const ORG = "00010203-0405-0607-0809-0a0b0c0d0e0f";

const shouldReset = process.argv.slice(2).includes("--reset");
const shouldDelete = process.argv.slice(2).includes("--delete");

const client = await createPGClient();

if (shouldDelete) {
  await client.query({
    text: `
      DROP TABLE IF EXISTS public.metrics;
      DROP INDEX IF EXISTS metrics_created_at_idx;
    `,
  });
} else {
  if (shouldReset) {
    await client.query({
      text: `
    DROP TABLE IF EXISTS public.metrics;
    DROP INDEX IF EXISTS metrics_created_at_idx;
  `,
    });

    await client.query({
      text: `
    CREATE TABLE public.metrics (
      "org" uuid NOT NULL,
      "id_tuple" text NOT NULL,
      "created_at" timestamp NOT NULL,
      "contents" jsonb DEFAULT NULL,
      PRIMARY KEY (org, id_tuple)
    );
    CREATE INDEX metrics_created_at_idx ON public.metrics USING btree (org, created_at);
  `,
    });
  }

  for (let index = 0; index < ARTIFACT_COUNT; index += 1) {
    const id = [{ kind: "main", id: `${index}` }];
    // Randomize the start time in a stable way such that no obvious cadence occurs.
    const date = new Date(START_TIME.getTime() + TIME_DISTANCE * (index + ((index * 67) % 97) / 97));
    const metric: StoredArtifactMetrics = {
      id,
      parentID: null,
      creationTime: date,
      modificationTime: date,
      metrics: [
        {
          type: "cosine",
          values: [
            {
              // Randomize the value between 0 and 1 in a stable way
              value: ((50 + index * 227) % 257) / 257,
              eventID: `00000000-0000-0000-0000-${index.toString(16).padStart(12, "0")}`,
            },
          ],
        },
      ],
      outcomes: [
        {
          type: "custom:isExported",
          values: [
            // Randomize the value to either 0 or 1 in a stable way
            {
              value: (50 + index * 29) % 2,
              eventID: `00000000-0000-0000-0001-${index.toString(16).padStart(12, "0")}`,
            },
          ],
        },
      ],
    };

    await client.query({
      text: `
      INSERT INTO "public"."metrics" (
        "org",
        "id_tuple",
        "created_at",
        "contents"
      ) VALUES (
        $1,
        $2,
        $3,
        $4
      )
    `,
      values: [ORG, JSON.stringify(id), date, JSON.stringify(metric)],
    });
  }
}

await client.end();
