/**
 * Layer 8 proof — session persistence across requests.
 *
 *  POST {action:"create"}        → new session, sets `sid` cookie
 *  POST {content:"..."}          → append a message to the session's history
 *  GET                           → returns the session (from Redis) + history
 *
 * The `sid` cookie carries the session across requests; the same session is
 * read back on later calls, and history is durable in Postgres.
 */
import { NextRequest, NextResponse } from "next/server";
import { route } from "@/lib/http/handler";
import { sessionStore } from "@/lib/session/session-store";
import { history } from "@/lib/session/history";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const COOKIE = "sid";

export const POST = route("/api/demo/session", async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    content?: string;
  };

  if (body.action === "create") {
    const session = await sessionStore.create("demo-user");
    await history.ensureSession(session.id, "demo-user");
    const res = NextResponse.json({ sessionId: session.id, createdAt: session.createdAt });
    res.cookies.set(COOKIE, session.id, { httpOnly: true, sameSite: "lax", path: "/" });
    return res;
  }

  const sid = req.cookies.get(COOKIE)?.value;
  if (!sid) throw new AppError({ category: "validation", message: "no session; create one first" });
  const session = await sessionStore.get(sid);
  if (!session) throw new AppError({ category: "not_found", message: "session expired" });

  if (body.content) {
    await history.append(sid, "user", body.content);
    await sessionStore.touch(sid);
    const msgs = await history.list(sid);
    return NextResponse.json({ sessionId: sid, messageCount: msgs.length });
  }

  throw new AppError({ category: "validation", message: "provide action:create or content" });
});

export const GET = route("/api/demo/session", async (req: NextRequest) => {
  const sid = req.cookies.get(COOKIE)?.value;
  if (!sid) throw new AppError({ category: "validation", message: "no session cookie" });
  const session = await sessionStore.get(sid);
  if (!session) throw new AppError({ category: "not_found", message: "session expired" });
  const msgs = await history.list(sid);
  return NextResponse.json({
    session,
    messageCount: msgs.length,
    messages: msgs.map((m) => ({ role: m.role, content: m.content })),
  });
});
