/**
 * Layer 4 — SSE streaming transport. Emits a sequence of chunks as
 * Server-Sent Events so the client can render progressively. Carries the
 * correlation id and is rate-limit friendly. A terminal `done` event closes it.
 */
import { NextRequest } from "next/server";
import { newRequestId, REQUEST_ID_HEADER } from "@/lib/observability/request-context";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

const logger = log("stream");

export async function GET(req: NextRequest) {
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? newRequestId();
  const url = new URL(req.url);
  const count = Math.min(Number(url.searchParams.get("count") ?? 8) || 8, 50);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      logger.info({ request_id: requestId, count }, "stream open");
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send("open", { requestId });
      for (let i = 1; i <= count; i++) {
        await new Promise((r) => setTimeout(r, 250));
        send("chunk", { i, total: count, text: `chunk ${i}/${count}` });
      }
      send("done", { requestId, count });
      logger.info({ request_id: requestId }, "stream complete");
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}
