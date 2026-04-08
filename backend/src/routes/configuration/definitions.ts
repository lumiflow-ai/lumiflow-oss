import { z } from "zod";

import { installAPIExtensions } from "@/lib/apiGeneration";

import { OrganizationIDSchema } from "../orgs/definitions";

installAPIExtensions();

// MARK: - Configurations

export const ColumnDescriptorSchema = z
  .object({
    title: z.string(),
    keyPaths: z.array(z.string()),
    width: z.union([z.number(), z.literal("auto")]),
    description: z.string().optional(),
  })
  .api("ColumnDescriptor");

export const TableDescriptorSchema = z.array(ColumnDescriptorSchema).api("TableDescriptor");

export const TableConfigurationContextSchema = z.enum(["list", "detail"]).api("TableConfigurationContext");

// MARK: - HTTP

export const TableConfigurationRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    kind: z.string().nullish(),
    context: TableConfigurationContextSchema,
  })
  .api("TableConfigurationRequest");

export const TableConfigurationResponseSchema = z
  .object({
    table: TableDescriptorSchema.nullable(),
  })
  .api("TableConfigurationResponse");
