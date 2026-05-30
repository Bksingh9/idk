/**
 * Per-request plumbing for API routes (Layers 5/7).
 *
 * Wrap every route handler with `route()` to get:
 *  - a request-scoped async context carrying the correlation id (rule 5)
 *  - one structured log line per request with route, method, status, latency
 *  - HTTP metrics (count + duration histogram)
 *  - normalized error → JSON responses (AppError-aware), never a naked 500 stack
 */
import { NextRequest, NextResponse } from "next/server";
import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { recordHttp } from "@/lib/observability/metrics";
import { captureError } from "@/lib/observability/sentry";
import {
  REQUEST_ID_HEADER,
  newRequestId,
  runWithContext,
} from "@/lib/observability/request-context";

type Handler = (req: NextRequest, ctx: RouteCtx) => Promise<NextResponse> | NextResponse;

interface RouteCtx {
  params?: Record<string, string | string[]>;
}

export function route(routeName: string, handler: Handler) {
  return async (req: NextRequest, ctx: RouteCtx): Promise<NextResponse> => {
    const requestId = req.headers.get(REQUEST_ID_HEADER) ?? newRequestId();
    const method = req.method;
    const start = performance.now();

    return runWithContext({ requestId, route: routeName, method }, async () => {
      logger.info({ event: "request.start" }, "request received");
      try {
        const res = await handler(req, ctx);
        const latency = performance.now() - start;
        res.headers.set(REQUEST_ID_HEADER, requestId);
        recordHttp(method, routeName, res.status, latency);
        logger.info(
          { event: "request.end", status: res.status, latency_ms: Math.round(latency), outcome: "success" },
          "request completed"
        );
        return res;
      } catch (err) {
        const latency = performance.now() - start;
        const appErr: AppError = isAppError(err)
          ? err
          : new AppError({ category: "internal", message: "internal error", cause: err });
        if (appErr.category === "internal") captureError(err);
        recordHttp(method, routeName, appErr.httpStatus, latency);
        logger.warn(
          {
            event: "request.end",
            status: appErr.httpStatus,
            latency_ms: Math.round(latency),
            outcome: "error",
            category: appErr.category,
          },
          "request failed"
        );
        const res = NextResponse.json(appErr.toJSON(), { status: appErr.httpStatus });
        res.headers.set(REQUEST_ID_HEADER, requestId);
        if (appErr.retryAfterSeconds != null) {
          res.headers.set("Retry-After", String(appErr.retryAfterSeconds));
        }
        return res;
      }
    });
  };
}
