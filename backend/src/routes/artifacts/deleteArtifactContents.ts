import { withIdempotentTransaction, withPGClient } from "@/server/persistence";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { HTTPError, RouteGroup } from "@/lib/routeGroup";

import { encodeArtifactPathComponents } from "@/model/artifactPath";

import { DeleteArtifactContentsRequestSchema, DeleteArtifactContentsResponseSchema } from "./definitions";

export const deleteContents = new RouteGroup();

deleteContents.delete(
  null,
  {
    requestSchema: DeleteArtifactContentsRequestSchema,
    responseSchema: DeleteArtifactContentsResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context) => {
    if (!context.user?.organizations.has(request.orgID.toLowerCase())) {
      throw new AuthorizationError();
    }

    const encodedPath = encodeArtifactPathComponents(request.artifactPath);

    const query = new DeleteArtifactQueryBuilder()
      .whereOrg(request.orgID)
      .whereArtifactPath(encodedPath, request.deleteSubartifacts ?? false)
      .whereEventSummary(request.eventSummaryID)
      .build();

    const deleteResults = await withPGClient(context, async (context) => {
      return await withIdempotentTransaction(context, async ({ pgClient }) => {
        return await pgClient.query(query);
      });
    });

    // Validate the deletion results
    if (request.deleteSubartifacts) {
      if (deleteResults.rowCount === 0) {
        throw new HTTPError(404, "Artifact Not Found");
      }
    } else {
      if (deleteResults.rowCount !== 1) {
        throw new HTTPError(404, "Artifact Not Found");
      }
    }

    const deletedCount = deleteResults.rowCount ?? 0;
    const message =
      request.deleteSubartifacts && deletedCount > 1
        ? `Deleted ${deletedCount} artifact(s) (including sub-artifacts).`
        : "Artifact deleted.";

    return {
      status: "success",
      message,
    };
  },
);

/**
 * Query builder for artifact snapshot deletion that manages PostgreSQL parameter indexing internally
 */
class DeleteArtifactQueryBuilder {
  private conditions: string[] = [];
  private values: unknown[] = [];
  private paramIndex = 1;

  whereOrg(orgID: string): this {
    this.conditions.push(`"org_id" = $${this.paramIndex}`);
    this.values.push(orgID);
    this.paramIndex++;
    return this;
  }

  whereArtifactPath(encodedPath: string[][], deleteSubartifacts: boolean): this {
    if (deleteSubartifacts) {
      const pathLength = encodedPath.length;
      this.conditions.push(`(
        "artifact_path" = $${this.paramIndex}
        OR ("artifact_path"[1:$${this.paramIndex + 1}] = $${this.paramIndex} AND array_length("artifact_path", 1) > $${this.paramIndex + 1})
      )`);
      this.values.push(encodedPath, pathLength);
      this.paramIndex += 2;
    } else {
      this.conditions.push(`"artifact_path" = $${this.paramIndex}`);
      this.values.push(encodedPath);
      this.paramIndex++;
    }
    return this;
  }

  whereEventSummary(eventSummaryID?: string): this {
    if (eventSummaryID) {
      this.conditions.push(`"event_summary_id" = $${this.paramIndex}`);
      this.values.push(eventSummaryID);
      this.paramIndex++;
    }
    return this;
  }

  build(): { text: string; values: unknown[] } {
    if (this.conditions.length === 0) {
      throw new Error("Cannot build DELETE query with no conditions");
    }

    return {
      text: `
        DELETE FROM public.artifact_snapshots
        WHERE ${this.conditions.join(" AND ")};
      `,
      values: this.values,
    };
  }
}
