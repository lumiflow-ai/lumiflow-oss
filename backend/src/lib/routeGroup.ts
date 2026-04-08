import express, { type Express, type Request, type Response } from "express";
import type pg from "pg";
import type { Logger } from "pino";
import { ZodObject, type ZodType, ZodUnion, z } from "zod";

import { CONFIG, isDev } from "@/serverInitSetup/config";

import {
  AuthenticationError,
  AuthorizationError,
  type AuthorizationManager,
  type AuthorizationRequirement,
  type UserSession,
} from "@/lib/authorization";

import type { Managers } from "@/model/managers";

/**
 * Schema for file download responses with content type and disposition headers.
 */
export const DownloadSchema = z.object({
  content: z.string(),
  contentType: z.string(),
  filename: z.string(),
  disposition: z.enum(["attachment", "inline"]).default("attachment"),
});

type DownloadShape = z.infer<typeof DownloadSchema>;

/**
 * File download response class.
 * Implements the same shape as DownloadSchema for compile-time type safety.
 *
 * @param content - File content as string
 * @param filename - Download filename
 * @param contentType - MIME type (e.g., 'text/csv', 'application/json')
 * @param disposition - Browser behavior: 'attachment' (download) or 'inline' (display), defaults to 'attachment'
 */
export class Download implements DownloadShape {
  constructor(
    public readonly content: string,
    public readonly filename: string,
    public readonly contentType: string,
    public readonly disposition: "attachment" | "inline" = "attachment",
  ) {}
}

export interface RequestContext {
  httpRequest: Request;
  pgPool: pg.Pool;
  logger: Logger;
  user?: UserSession;
  auth?: AuthorizationRequirement;
  managers: Managers;
}

export class HTTPError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }

  toJSON() {
    return {
      name: `${this.name}-${this.status}`,
      message: this.message,
      stack: isDev ? this.stack : undefined,
      cause: this.cause,
    };
  }
}

export class RedirectError extends HTTPError {}

interface RouteOptions<RequestSchema, ResponseSchema> {
  requestSchema: RequestSchema;
  responseSchema: ResponseSchema;
  clientName?: string;
  summary?: string;
  requestDescription?: string;
  responseDescription?: string;
  auth?: AuthorizationRequirement | AuthorizationRequirement[];
  contentType?: string;
}

type RouteRegistration = {
  method: "get" | "post" | "put" | "delete";
  path: string;
  options: RouteOptions<ZodType, ZodType>;
  handler: (request: z.infer<ZodType>, context: RequestContext) => unknown;
};

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

  get<
    RequestSchema extends ZodType,
    ResponseSchema extends ZodType,
    RequestType = z.infer<RequestSchema>,
    ResponseType = z.infer<ResponseSchema>,
  >(
    path: string | null,
    options: RouteOptions<RequestSchema, ResponseSchema>,
    handler: (request: RequestType, context: RequestContext) => Promise<ResponseType>,
  ) {
    this.propagate({ method: "get", path: path ?? "", options, handler });
  }

  post<
    RequestSchema extends ZodType,
    ResponseSchema extends ZodType,
    RequestType = z.infer<RequestSchema>,
    ResponseType = z.infer<ResponseSchema>,
  >(
    path: string | null,
    options: RouteOptions<RequestSchema, ResponseSchema>,
    handler: (request: RequestType, context: RequestContext) => Promise<ResponseType>,
  ) {
    this.propagate({ method: "post", path: path ?? "", options, handler });
  }

  put<
    RequestSchema extends ZodType,
    ResponseSchema extends ZodType,
    RequestType = z.infer<RequestSchema>,
    ResponseType = z.infer<ResponseSchema>,
  >(
    path: string | null,
    options: RouteOptions<RequestSchema, ResponseSchema>,
    handler: (request: RequestType, context: RequestContext) => Promise<ResponseType>,
  ) {
    this.propagate({ method: "put", path: path ?? "", options, handler });
  }

  delete<
    RequestSchema extends ZodType,
    ResponseSchema extends ZodType,
    RequestType = z.infer<RequestSchema>,
    ResponseType = z.infer<ResponseSchema>,
  >(
    path: string | null,
    options: RouteOptions<RequestSchema, ResponseSchema>,
    handler: (request: RequestType, context: RequestContext) => Promise<ResponseType>,
  ) {
    this.propagate({ method: "delete", path: path ?? "", options, handler });
  }

  private propagate(route: RouteRegistration) {
    const { method, path, options } = route;
    let fullPath: string;
    if (this.component && path) {
      fullPath = `${this.component}/${path}`;
    } else if (this.component) {
      fullPath = this.component;
    } else {
      fullPath = path ?? "";
    }

    const lastPathComponent = fullPath.split("/").at(-1);
    const capitalizedPath = lastPathComponent
      ? String(lastPathComponent[0]).toUpperCase() + String(lastPathComponent).slice(1)
      : "";
    const clientName = capitalizedPath ? `${method}${capitalizedPath}` : undefined;

    const registration = {
      ...route,
      options: { ...options, clientName: options.clientName ?? clientName },
      path: fullPath,
    };

    if (this.parent) {
      this.parent.propagate(registration);
    } else {
      this.registeredRoutes.set(`${registration.path} - ${method}`, registration);
    }
  }
}

function logHTTPRequest(httpRequest: Request) {
  let body: unknown;
  try {
    body = JSON.parse(httpRequest.body);
  } catch {}
  return {
    hostname: httpRequest.hostname,
    method: httpRequest.method,
    path: httpRequest.url,
    body,
  };
}

function sendError(code: number, reason: string, httpResponse: Response, error?: unknown) {
  httpResponse.status(code).send({
    type: "error",
    reason,
    error,
  });
}

async function handleRequest({
  path,
  route,
  managers,
  authorization,
  pgPool,
  logger,
  httpRequest,
  httpResponse,
  parseRequest,
}: {
  path: string;
  route: RouteRegistration;
  managers: Managers;
  authorization: AuthorizationManager;
  pgPool: pg.Pool;
  logger: Logger;
  httpRequest: Request;
  httpResponse: Response;
  parseRequest: () => z.infer<ZodType>;
}) {
  try {
    const validatedAuth = await authorization.validateAuthorization({
      auth: route.options.auth,
      httpRequest,
      managers,
      pgPool,
      logger,
    });

    const routeLogger = logger.child({ route: `/${path}`, ...validatedAuth, httpRequest: logHTTPRequest(httpRequest) });

    /// Decode the request based on how the caller interprets it
    let request: z.infer<typeof route.options.requestSchema>;
    try {
      request = parseRequest();
    } catch (error) {
      routeLogger.info({ error }, "Error decoding request.");
      sendError(400, "Bad Request", httpResponse, error as Error);
      return;
    }

    /// Pass the request to the route handler
    const result = await route.handler(request, {
      httpRequest,
      ...validatedAuth,
      managers,
      pgPool,
      logger: routeLogger,
    });

    /// Send the response
    if (result instanceof Download) {
      // Handle Download response
      httpResponse
        .status(200)
        .contentType(result.contentType)
        .setHeader("Content-Disposition", `${result.disposition}; filename="${result.filename}"`)
        .send(result.content);
    } else if (route.options.contentType) {
      httpResponse.status(200).contentType(route.options.contentType).send(result);
    } else {
      httpResponse.status(200).send(result);
    }
  } catch (error) {
    /// Catch any errors
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      logger.warn(
        { route: `/${path}`, httpRequest: logHTTPRequest(httpRequest), error },
        "Request failed authorization checks.",
      );
    } else {
      logger.error(
        { route: `/${path}`, httpRequest: logHTTPRequest(httpRequest), error },
        "Error responding to request.",
      );
    }

    if (error instanceof RedirectError) {
      httpResponse.redirect(error.status, error.message);
    } else if (error instanceof HTTPError) {
      sendError(error.status, error.message, httpResponse);
    } else if (error instanceof AuthenticationError) {
      sendError(401, "Authentication Error", httpResponse, error);
    } else if (error instanceof AuthorizationError) {
      sendError(403, "Authorization Error", httpResponse, error);
    } else {
      sendError(500, "Internal Server Error", httpResponse, error);
    }
  }
}

/** Install a route group on an express app. */
export function installRoutesOnExpress({
  routes,
  app,
  managers,
  authorization,
  pgPool,
  logger,
}: {
  routes: RouteGroup;
  app: Express;
  managers: Managers;
  authorization: AuthorizationManager;
  pgPool: pg.Pool;
  logger: Logger;
}) {
  // Keep this configurable since acceptable payload sizes differ by environment and traffic profile.
  const requestBodyLimit = CONFIG.BACKEND_REQUEST_BODY_LIMIT;

  app.use(express.json({ limit: requestBodyLimit }));
  app.use(express.text({ limit: requestBodyLimit }));

  for (const [_, route] of routes.registeredRoutes) {
    switch (route.method) {
      case "get":
        logger.debug(`Registered GET /${route.path} at ${route.options.clientName ?? "missing"}()`);
        app.get(`/${route.path}`, async (httpRequest: Request, httpResponse: Response) => {
          await handleRequest({
            path: route.path,
            route,
            httpRequest,
            httpResponse,
            managers,
            authorization,
            pgPool,
            logger,
            parseRequest() {
              if (
                route.options.requestSchema instanceof ZodObject ||
                (route.options.requestSchema instanceof ZodUnion &&
                  route.options.requestSchema.options.every((option: unknown) => option instanceof ZodObject))
              ) {
                return route.options.requestSchema.parse(httpRequest.query);
              }
              return undefined;
            },
          });
        });
        break;
      case "put":
        logger.debug(`Registered PUT /${route.path} at ${route.options.clientName ?? "missing"}()`);
        app.put(`/${route.path}`, async (httpRequest: Request, httpResponse: Response) => {
          await handleRequest({
            path: route.path,
            route,
            httpRequest,
            httpResponse,
            managers,
            authorization,
            pgPool,
            logger,
            parseRequest() {
              return route.options.requestSchema.parse(httpRequest.body);
            },
          });
        });
        break;
      case "post":
        logger.debug(`Registered POST /${route.path} at ${route.options.clientName ?? "missing"}()`);
        app.post(`/${route.path}`, async (httpRequest: Request, httpResponse: Response) => {
          await handleRequest({
            path: route.path,
            route,
            httpRequest,
            httpResponse,
            managers,
            authorization,
            pgPool,
            logger,
            parseRequest() {
              return route.options.requestSchema.parse(httpRequest.body);
            },
          });
        });
        break;
      case "delete":
        logger.debug(`Registered DELETE /${route.path} at ${route.options.clientName ?? "missing"}()`);
        app.delete(`/${route.path}`, async (httpRequest: Request, httpResponse: Response) => {
          await handleRequest({
            path: route.path,
            route,
            httpRequest,
            httpResponse,
            managers,
            authorization,
            pgPool,
            logger,
            parseRequest() {
              return route.options.requestSchema.parse(httpRequest.body);
            },
          });
        });
        break;
      // no-default
    }
  }
}
