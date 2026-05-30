/**
 * Edge middleware — runs before every matched request.
 *
 *  - Assigns a correlation id (x-request-id) if the caller didn't supply one,
 *    propagating it to the handler and echoing it on the response (rule 5).
 *  - Applies security headers + CORS allow-list (Layer 10).
 *  - Handles CORS preflight.
 *
 * Auth enforcement for protected routes is layered in via withAuth at the route
 * level (server runtime) since it needs Node APIs; middleware stays edge-light.
 */
import { NextRequest, NextResponse } from "next/server";
import { applyCors, applySecurityHeaders } from "@/lib/http/security";

const REQUEST_ID_HEADER = "x-request-id";

function genId(): string {
  return crypto.randomUUID();
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? genId();

  // Preflight
  if (req.method === "OPTIONS") {
    const preflight = new NextResponse(null, { status: 204 });
    preflight.headers.set(REQUEST_ID_HEADER, requestId);
    return applyCors(applySecurityHeaders(preflight), origin);
  }

  // Forward the request id to the handler.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set(REQUEST_ID_HEADER, requestId);
  return applyCors(applySecurityHeaders(res), origin);
}

export const config = {
  // Apply to everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
