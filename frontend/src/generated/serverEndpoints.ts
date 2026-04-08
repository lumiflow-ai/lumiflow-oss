import useSWR from "swr";
import { useCallback, useMemo } from "react";

import {
  AccountResponse,
  CreateArtifactRequest,
  CreateArtifactResponse,
  CreateSnapshotsRequest,
  CreateSnapshotsResponse,
  DefaultDashboardRequest,
  DefaultDashboardResponse,
  DeleteArtifactContentsRequest,
  DeleteArtifactContentsResponse,
  LoadRecipesRequest,
  LoadRecipesResponse,
  MetricDefinitionsRequest,
  MetricDefinitionsResponse,
  OrganizationsResponse,
  OrgConfigurationRequest,
  OrgConfigurationResponse,
  OrgEvaluationModelsRequest,
  OrgEvaluationModelsResponse,
  OrgUsersRequest,
  OrgUsersResponse,
  RecordArtifactContentsRequest,
  RecordArtifactContentsResponse,
  PreviewRecipeRequest,
  PreviewRecipeResponse,
  RecordMetricDefinitionRequest,
  RecordMetricDefinitionResponse,
  RecordRecipeRequest,
  RecordRecipeResponse,
  RunRecipesRequest,
  RunRecipesResponse,
  CancelEvaluationRequest,
  CancelEvaluationResponse,
  SignupRequest,
  SignupResponse,
  TableConfigurationRequest,
  TableConfigurationResponse,
} from "./serverTypes";

/** Construct a URL string based on a path and optional query, tied to the current backend. */
export function getBackendURL(path: string, query: URLSearchParams | null = null) {
  const host = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000/";
  const url = new URL(path, host);
  query?.forEach((value: string, key: string) => {
    url.searchParams.append(key, value);
  });
  return url.toString();
}

/** Flatten an object recursively into keys within a URLSearchQuery, which express natively supports */
function encodeValueToQuery(key: string, value: unknown, query: URLSearchParams) {
  /// Skip undefined and null values
  if (value === undefined || value === null) return;

  if (typeof value === "object") {
    /// Recursively encode arrays as `?key[0]=value&key[1]=value`
    if (Array.isArray(value)) {
      for (const [index, child] of value.entries()) {
        encodeValueToQuery(`${key}[${index}]`, child, query);
      }
      return;
    }
    /// Encode dates as ISO8601 timestamps.
    if (value instanceof Date) {
      query.append(key, `${value.toISOString()}`);
      return;
    }
    /// Recursively encode objects as `?key[a]=value&key[b]=value`
    for (const [index, child] of Object.entries(value as object)) {
      encodeValueToQuery(`${key}[${index}]`, child, query);
    }
    return;
  }

  /// Encode primitives as strings.
  query.append(key, `${value}`);
  return;
}

/** Encode an object to a URL query suitable for GET requests. Only shallow objects are fully supported — any nested objects will be encoded as JSON. */
function encodeToQuery(object: { [string: string]: string | number | boolean | object | undefined | null } | null): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(object ?? {})) {
    encodeValueToQuery(key, value, query);
  }
  return query;
}

export type SWRResponse<T> = { response: T | undefined; error: Error | undefined; isLoading: boolean; refresh: () => Promise<T | undefined> };

export class HTTPResponseError extends Error {
  readonly status: number;

  constructor(reason: string, status: number) {
    super(reason);
    this.name = "HTTPResponseError";
    this.status = status;
  }
}

/** Fetch a GET endpoint with the specified request. */
export async function fetchGET<Response>(
  path: string,
  request: { [string: string]: string | number | boolean | object | undefined | null } | null,
  signal: AbortSignal | null
): Promise<Response> {
  const query = encodeToQuery(request);
  const url = getBackendURL(path, query);

  let response: globalThis.Response;
  try {
    response = await fetch(url, { method: "GET", signal, credentials: "include" });
  } catch (error) {
    throw error;
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    throw error;
  }

  if (response.status != 200) {
    const reason =
      typeof json === "object" && json && "reason" in json && typeof json.reason === "string"
        ? json.reason
        : `HTTP ${response.status}`;
    throw new HTTPResponseError(reason, response.status);
  }

  return json as Response;
}

function shouldRetryGETOnError(error: unknown) {
  if (error instanceof HTTPResponseError && (error.status === 401 || error.status === 403)) return false;
  return true;
}

function useFetchGET<Response>(
  path: string,
  request: { [string: string]: string | number | boolean | object | undefined | null } | null | undefined,
): SWRResponse<Response> {
  // biome-ignore lint/correctness/useExhaustiveDependencies: Using a manual dependency since we don't know the shape of the object.
  const memoizedRequest = useMemo(() => request, [JSON.stringify(request)]);

  const { data, error, isLoading, mutate } = useSWR(
    memoizedRequest !== undefined ? [path, memoizedRequest] : undefined,
    ([path, query]) => fetchGET(path, query, null) as Promise<Response>,
    { shouldRetryOnError: shouldRetryGETOnError },
  );

  const actualLoadingState = memoizedRequest !== undefined ? isLoading : true;

  /// Simplified refresh method that forces a request to the server.
  const refresh = useCallback(() => mutate(), [mutate]);

  return useMemo(
    () => ({ response: data, error, isLoading: actualLoadingState, refresh }),
    [data, error, actualLoadingState]
  );
}

export const __visibleForTesting = { shouldRetryGETOnError };

/** Fetch an endpoint with the specified method and request, encoding it to the body. */
async function fetchWithBody<Request, Response>({
  method,
  path,
  request,
  signal,
  responseType = "json"
}: {
  method: "POST" | "PUT" | "DELETE";
  path: string;
  request: Request | null;
  signal: AbortSignal | null;
  responseType?: "json" | "string";
}): Promise<Response> {
  const response = await fetch(getBackendURL(path), {
    method,
    credentials: "include",
    headers: request
      ? {
        "Content-Type": "application/json",
      }
      : undefined,
    body: request ? JSON.stringify(request) : null,
    signal,
  });

  if (responseType === "json") {
    const json = await response.json();
    if (response.status != 200) throw new Error(json.reason);

    return json;
  } else {
    const text = await response.text();
    if (response.status != 200) throw new Error((await response.json()).reason);

    return text as Response;
  }
}

/** Fetch a POST endpoint with the specified request. */
async function fetchPOST<Request, Response>(
  path: string,
  request: Request | null,
  signal: AbortSignal | null,
  responseType: "json" | "string" = "json"
): Promise<Response> {
  return await fetchWithBody({ method: "POST", path, request, signal, responseType })
}

/** Fetch a PUT endpoint with the specified request. */
async function fetchPUT<Request, Response>(
  path: string,
  request: Request | null,
  signal: AbortSignal | null,
  responseType: "json" | "string" = "json"
): Promise<Response> {
  return await fetchWithBody({ method: "PUT", path, request, signal, responseType })
}

/** Fetch a DELETE endpoint with the specified request. */
async function fetchDELETE<Request, Response>(
  path: string,
  request: Request | null,
  signal: AbortSignal | null,
  responseType: "json" | "string" = "json"
): Promise<Response> {
  return await fetchWithBody({ method: "DELETE", path, request, signal, responseType })
}

// MARK: - Generated Methods

export function useOrgs(): SWRResponse<OrganizationsResponse> {
  return useFetchGET("v0.1/orgs", null);
}

export function useAccount(): SWRResponse<AccountResponse> {
  return useFetchGET("v0.1/account", null);
}

export function useOrgConfiguration(request: OrgConfigurationRequest | undefined): SWRResponse<OrgConfigurationResponse> {
  return useFetchGET("v0.1/org/configuration", request);
}

export function useOrgEvaluationModels(
  request: OrgEvaluationModelsRequest | undefined,
): SWRResponse<OrgEvaluationModelsResponse> {
  return useFetchGET("v0.1/org/evaluation-models", request);
}

export function useOrgUsers(request: OrgUsersRequest | undefined): SWRResponse<OrgUsersResponse> {
  return useFetchGET("v0.1/org/users", request);
}

export async function fetchCreateArtifact(
  request: CreateArtifactRequest,
  signal: AbortSignal | null = null
): Promise<CreateArtifactResponse> {
  return await fetchPUT("v0.1/artifacts/create", request, signal);
}

export async function fetchDeleteArtifact(
  request: DeleteArtifactContentsRequest,
  signal: AbortSignal | null = null
): Promise<DeleteArtifactContentsResponse> {
  return await fetchDELETE("v0.1/artifacts", request, signal);
}

export async function fetchCreateSnapshots(
  request: CreateSnapshotsRequest,
  signal: AbortSignal | null = null
): Promise<CreateSnapshotsResponse> {
  return await fetchPUT("v0.1/artifacts/snapshots/create", request, signal);
}

export async function fetchRecordArtifactContents(
  request: RecordArtifactContentsRequest,
  signal: AbortSignal | null = null
): Promise<RecordArtifactContentsResponse> {
  return await fetchPUT("v0.1/artifacts", request, signal);
}

export async function fetchTableConfiguration(
  request: TableConfigurationRequest,
  signal: AbortSignal | null = null
): Promise<TableConfigurationResponse> {
  return await fetchGET("v0.1/configuration/table", request, signal);
}

export function useTableConfiguration(request: TableConfigurationRequest | undefined): SWRResponse<TableConfigurationResponse> {
  return useFetchGET("v0.1/configuration/table", request);
}

export async function fetchDashboard(
  request: DefaultDashboardRequest,
  signal: AbortSignal | null = null
): Promise<DefaultDashboardResponse> {
  return await fetchGET("v0.1/dashboards/default", request, signal);
}

export function useDashboard(request: DefaultDashboardRequest | undefined): SWRResponse<DefaultDashboardResponse> {
  return useFetchGET("v0.1/dashboards/default", request);
}

export async function fetchPagedMetricDefinitions(
  request: MetricDefinitionsRequest,
  signal: AbortSignal | null = null
): Promise<MetricDefinitionsResponse> {
  return await fetchGET("v0.1/org/metrics", request, signal);
}

export function usePagedMetricDefinitions(request: MetricDefinitionsRequest | undefined): SWRResponse<MetricDefinitionsResponse> {
  return useFetchGET("v0.1/org/metrics", request);
}

export async function fetchRecipes(
  request: LoadRecipesRequest,
  signal: AbortSignal | null = null
): Promise<LoadRecipesResponse> {
  return await fetchGET("v0.1/recipes", request, signal);
}

export function useRecipes(request: LoadRecipesRequest | undefined): SWRResponse<LoadRecipesResponse> {
  return useFetchGET("v0.1/recipes", request);
}

export async function fetchRecordRecipe(
  request: RecordRecipeRequest,
  signal: AbortSignal | null = null
): Promise<RecordRecipeResponse> {
  return await fetchPOST("v0.1/recipes", request, signal);
}

export async function fetchPreviewRecipe(
  request: PreviewRecipeRequest,
  signal: AbortSignal | null = null
): Promise<PreviewRecipeResponse> {
  return await fetchPUT("v0.1/recipes/preview", request, signal);
}


export async function fetchRecordMetricDefinition(
  request: RecordMetricDefinitionRequest,
  signal: AbortSignal | null = null
): Promise<RecordMetricDefinitionResponse> {
  return await fetchPUT("v0.1/org/metrics", request, signal);
}

export async function fetchRunRecipes(
  request: RunRecipesRequest,
  signal: AbortSignal | null = null
): Promise<RunRecipesResponse> {
  return await fetchPOST("v0.1/recipes/run", request, signal);
}

export async function fetchCancelEvaluation(
  request: CancelEvaluationRequest,
  signal: AbortSignal | null = null
): Promise<CancelEvaluationResponse> {
  return await fetchPOST("v0.1/recipes/cancel", request, signal);
}

export async function fetchSignup(
  request: SignupRequest,
  signal: AbortSignal | null = null
): Promise<SignupResponse> {
  return await fetchPOST("v0.1/signup", request, signal);
}
