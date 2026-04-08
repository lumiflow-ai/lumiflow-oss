import { z } from "zod";

import { OrganizationTemplate } from "@/types";

import { installAPIExtensions } from "@/lib/apiGeneration";

import { UUIDSchema } from "@/definitions/primitives";

installAPIExtensions();

// MARK: - Identifiers

export const OrganizationIDSchema = UUIDSchema.api("OrganizationID");

// MARK: - Accounts

export const OrganizationTemplateSchema = z
  .enum([OrganizationTemplate.demo, OrganizationTemplate.general])
  .api("OrganizationTemplate");

export const OrganizationSchema = z
  .object({
    id: OrganizationIDSchema,
    name: z.string(),
    template: OrganizationTemplateSchema.optional(),
    isDeleted: z.literal(true).optional(),
  })
  .api("Organization");

// MARK: - HTTP

export const OrganizationsResponseSchema = z
  .object({
    orgs: z.array(OrganizationSchema),
  })
  .api("OrganizationsResponse");

export const CreateOrganizationRequestSchema = z
  .object({
    name: z.string().min(1),
  })
  .api("CreateOrganizationRequest");

export const CreateOrganizationResponseSchema = z
  .object({
    organization: OrganizationSchema,
  })
  .api("CreateOrganizationResponse");
