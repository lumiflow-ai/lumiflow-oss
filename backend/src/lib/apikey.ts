import type { Request } from "express";

import { CONFIG } from "@/serverInitSetup/config";

import { AuthorizationError } from "./authorization";

function configuredAPIKeys() {
  return new Set(
    (process.env.API_KEYS ?? CONFIG.API_KEYS)
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key.length > 0),
  );
}

export async function validateAPIKey(httpRequest: Request) {
  const apiKey = httpRequest.headers["x-api-key"];
  if (!apiKey) throw new AuthorizationError("Missing X-API-Key header.");
  if (typeof apiKey !== "string") throw new AuthorizationError("X-API-Key header must be a string");

  const apiKeys = configuredAPIKeys();
  if (apiKeys.size === 0) throw new AuthorizationError("API key auth is not configured.");
  if (!apiKeys.has(apiKey)) throw new AuthorizationError("Invalid API-Key.");

  return true;
}
