/**
 * Request correlation context (rule 5).
 *
 * A request ID is generated at the edge (middleware) and propagated via the
 * `x-request-id` header. Server code runs inside `runWithContext` so every log
 * line and metric can be tagged with the same id without threading it manually.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

export interface RequestContext {
  requestId: string;
  route?: string;
  method?: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function newRequestId(): string {
  return randomUUID();
}

/** Mutate the current context (e.g. attach userId once auth resolves). */
export function setContextUser(userId: string): void {
  const store = storage.getStore();
  if (store) store.userId = userId;
}
