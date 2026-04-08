import { randomUUID } from "node:crypto";

import express, { type Express, type Request, type Response } from "express";
import type pg from "pg";
import type { Logger } from "pino";
import { ZodObject, type ZodType, type z } from "zod";

import { ResponseTypeSchema } from "@/definitions";

export interface RequestContext {
  httpRequest: Request;
  pgPool: pg.Pool;
  logger: Logger;
}

export class AuthorizationError extends Error {}

interface RouteOptions<RequestType = unknown, ResponseType = unknown> {
  requestType: ZodType<RequestType>;
  responseType: ZodType<ResponseType>;
  clientName?: string;
  summary?: string;
  requestDescription?: string;
  responseDescription?: string;
  contentType?: string;
}

type RouteRegistration = {
  method: "get" | "post" | "put";
  path: string;
  options: RouteOptions;
  handler: (request: z.infer<ZodType>, context: RequestContext) => unknown;
};

const redactedFieldNames = new Set(["password", "token", "credentials"]);
const redactedValue = "[REDACTED]";

export class RouteGroup {
  private parent: RouteGroup | null = null;
  private component = "";
  registeredRoutes: Map<string, RouteRegistration> = new Map();

  constructor(component?: string) {
    this.component = component ?? "";
  }

  /** Make a new route group anchored at the specified path component */
  group(component: string): RouteGroup {
    const child = new RouteGroup();
    child.parent = this;
    child.component = component;
    return child;
  }

  private getRoot(): RouteGroup | null {
    return this.parent?.getRoot() ?? null;
  }

  /** Install a route group into another one */
  install(routeGroup: RouteGroup) {
    // Make sure we don't create cyclic routes by accident.
    if (routeGroup === this || routeGroup.parent) return;

    for (const [_, route] of routeGroup.registeredRoutes) {
      this.propagate(route);
    }
  }

  get<RequestType, ResponseType>(
    path: string,
    options: RouteOptions<RequestType, ResponseType>,
    handler: (request: RequestType, context: RequestContext) => Promise<ResponseType>,
  ) {
    this.propagate({ method: "get", path, options, handler });
  }

  post<RequestType, ResponseType>(
    path: string,
    options: RouteOptions<RequestType, ResponseType>,
    handler: (request: RequestType, context: RequestContext) => Promise<ResponseType>,
  ) {
    this.propagate({ method: "post", path, options, handler });
  }

  put<RequestType, ResponseType>(
    path: string,
    options: RouteOptions<RequestType, ResponseType>,
    handler: (request: RequestType, context: RequestContext) => Promise<ResponseType>,
  ) {
    this.propagate({ method: "put", path, options, handler });
  }

  private propagate(route: RouteRegistration) {
    const { method, path, options } = route;
    const capitalizedPath = String(path[0]).toUpperCase() + String(path).slice(1);
    const clientName = `${method}${capitalizedPath}`;
    const fullPath = this.component ? `${this.component}/${path}` : path;

    const registration = {
      ...route,
      options: { clientName, ...options },
      path: fullPath,
    };

    if (this.parent) {
      this.parent.propagate(registration);
    } else {
      this.registeredRoutes.set(registration.path, registration);
    }
  }
}

function redactRequestBody(body: unknown): unknown {
  if (Array.isArray(body)) {
    return body.map(redactRequestBody);
  }

  if (body && typeof body === "object") {
    return Object.fromEntries(
      Object.entries(body).map(([key, value]) => [
        key,
        redactedFieldNames.has(key.toLowerCase()) ? redactedValue : redactRequestBody(value),
      ]),
    );
  }

  return body;
}

function logHTTPRequest(httpRequest: Request) {
  return {
    hostname: httpRequest.hostname,
    method: httpRequest.method,
    path: httpRequest.url,
    body: redactRequestBody(httpRequest.body),
  };
}

/** Install a route group on an express app. */
export function installRoutesOnExpress({
  routes,
  app,
  pgPool,
  logger,
}: {
  routes: RouteGroup;
  app: Express;
  pgPool: pg.Pool;
  logger: Logger;
}) {
  app.use(express.json());
  app.use(express.text());

  for (const [path, route] of routes.registeredRoutes) {
    switch (route.method) {
      case "get":
        logger.debug(`Registered GET /${path}`);
        app.get(`/${path}`, async (httpRequest: Request, httpResponse: Response) => {
          const requestID = randomUUID();
          const routeLogger = logger.child({
            route: `/${path}`,
            httpRequest: logHTTPRequest(httpRequest),
            requestID,
          });
          let request: z.infer<typeof route.options.requestType>;
          try {
            if (route.options.requestType instanceof ZodObject) {
              request = route.options.requestType.parse(httpRequest.query);
            }
          } catch (error) {
            routeLogger.info({ error }, "Error decoding request.");
            httpResponse.status(400).send({
              type: ResponseTypeSchema.enum.error,
              reason: `Bad Request. Request ID: ${requestID}`,
              error,
            });
            return;
          }
          try {
            const result = await route.handler(request, { httpRequest, pgPool, logger: routeLogger });
            if (route.options.contentType) {
              httpResponse.status(200).contentType(route.options.contentType).send(result);
            } else {
              httpResponse.status(200).send(result);
            }
          } catch (error) {
            routeLogger.error({ error }, "Error responding to request.");
            if (error instanceof AuthorizationError) {
              httpResponse.status(401).send({
                type: ResponseTypeSchema.enum.error,
                reason: `Authentication Error. Request ID: ${requestID}`,
                error,
              });
            } else {
              httpResponse.status(500).send({
                type: ResponseTypeSchema.enum.error,
                reason: `Internal Server Error. Request ID: ${requestID}`,
                error,
              });
            }
          }
        });
        break;
      case "put":
        logger.debug(`Registered PUT /${path}`);
        app.use(express.text()).put(`/${path}`, async (httpRequest: Request, httpResponse: Response) => {
          const requestID = randomUUID();
          const routeLogger = logger.child({
            route: `/${path}`,
            httpRequest: logHTTPRequest(httpRequest),
            requestID,
          });
          let request: z.infer<typeof route.options.requestType>;
          try {
            request = route.options.requestType.parse(httpRequest.body);
          } catch (error) {
            routeLogger.info({ error }, "Error decoding request.");
            httpResponse.status(400).send({
              type: ResponseTypeSchema.enum.error,
              reason: `Bad Request. Request ID: ${requestID}`,
              error,
            });
            return;
          }
          try {
            const result = await route.handler(request, { httpRequest, pgPool, logger: routeLogger });
            if (route.options.contentType) {
              httpResponse.status(200).contentType(route.options.contentType).send(result);
            } else {
              httpResponse.status(200).send(result);
            }
          } catch (error) {
            routeLogger.error({ error }, "Error responding to request.");
            if (error instanceof AuthorizationError) {
              httpResponse.status(401).send({
                type: ResponseTypeSchema.enum.error,
                reason: `Authentication Error. Request ID: ${requestID}`,
                error,
              });
            } else {
              httpResponse.status(500).send({
                type: ResponseTypeSchema.enum.error,
                reason: `Internal Server Error. Request ID: ${requestID}`,
                error,
              });
            }
          }
        });
        break;
      case "post":
        logger.debug(`Registered POST /${path}`);
        app.use(express.text()).post(`/${path}`, async (httpRequest: Request, httpResponse: Response) => {
          const requestID = randomUUID();
          const routeLogger = logger.child({
            route: `/${path}`,
            httpRequest: logHTTPRequest(httpRequest),
            requestID,
          });
          let request: z.infer<typeof route.options.requestType>;
          try {
            request = route.options.requestType.parse(httpRequest.body);
          } catch (error) {
            routeLogger.info({ error }, "Error decoding request.");
            httpResponse.status(400).send({
              type: ResponseTypeSchema.enum.error,
              reason: `Bad Request. Request ID: ${requestID}`,
              error,
            });
            return;
          }
          try {
            const result = await route.handler(request, { httpRequest, pgPool, logger: routeLogger });
            if (route.options.contentType) {
              httpResponse.status(200).contentType(route.options.contentType).send(result);
            } else {
              httpResponse.status(200).send(result);
            }
          } catch (error) {
            routeLogger.error({ error }, "Error responding to request.");
            if (error instanceof AuthorizationError) {
              httpResponse.status(401).send({
                type: ResponseTypeSchema.enum.error,
                reason: `Authentication Error. Request ID: ${requestID}`,
                error,
              });
            } else {
              httpResponse.status(500).send({
                type: ResponseTypeSchema.enum.error,
                reason: `Internal Server Error. Request ID: ${requestID}`,
                error,
              });
            }
          }
        });
        break;
      // no-default
    }
  }
}
