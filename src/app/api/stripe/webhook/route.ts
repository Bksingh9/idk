/**
 * Phase 5 — Stripe webhook. Verifies the signature against the raw body, then
 * syncs subscription state onto the developer's profile. Unauthenticated by
 * design (Stripe calls it); the signature IS the authentication.
 */
import { NextRequest, NextResponse } from "next/server";
import { route } from "@/lib/http/handler";
import { AppError } from "@/lib/errors";
import { features } from "@/lib/config/env";
import { stripeWrapper } from "@/lib/wrappers/stripe";
import { applyWebhookEvent } from "@/lib/services/billing-service";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

const logger = log("stripe");

export const POST = route("/api/stripe/webhook", async (req: NextRequest) => {
  if (!features.stripe) {
    throw new AppError({ category: "config", message: "billing not configured" });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) throw new AppError({ category: "validation", message: "missing stripe-signature" });

  const raw = await req.text();
  let event;
  try {
    event = stripeWrapper.constructEvent(raw, sig);
  } catch (e) {
    logger.warn({ err: String(e) }, "stripe signature verification failed");
    throw new AppError({ category: "unauthorized", message: "invalid signature" });
  }

  await applyWebhookEvent(event);
  return NextResponse.json({ received: true });
});
