import { type NextRequest, NextResponse } from "next/server";

import { isStagingAppEnvironment } from "@/library/env";

type ProcessEnv = Record<string, string | undefined>;

function getAccountURL(env: ProcessEnv = process.env) {
  const host = env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000/";
  return new URL("v0.1/account", host).toString();
}

function getLogoutURL(_request: NextRequest, env: ProcessEnv = process.env) {
  const logoutURL = new URL(env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000/");
  logoutURL.pathname = "logout";
  const pathURL = new URL("/app", "http://localhost");
  logoutURL.searchParams.set("path", `${pathURL.pathname}${pathURL.search}`);
  return logoutURL;
}

async function fetchAccount(request: NextRequest, env: ProcessEnv = process.env): Promise<number | null> {
  try {
    const cookieHeader = request.headers.get("cookie");
    const response = await fetch(getAccountURL(env), {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });

    return response.status;
  } catch {
    return null;
  }
}

export async function handleStagingAccess(
  request: NextRequest,
  env: ProcessEnv = process.env,
  fetchAccountFunction: typeof fetchAccount = fetchAccount,
): Promise<NextResponse | null> {
  if (!isStagingAppEnvironment(env)) return null;

  const accountStatus = await fetchAccountFunction(request, env);
  if (accountStatus === 403) {
    return NextResponse.redirect(getLogoutURL(request, env));
  }

  return null;
}
