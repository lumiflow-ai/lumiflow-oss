import { type NextRequest, NextResponse } from "next/server";

import { handleStagingAccess } from "./middleware/stagingAccess";

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const stagingResponse = await handleStagingAccess(request);
  if (stagingResponse) return stagingResponse;

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/app/:path*", "/navigator/:path*"],
};
