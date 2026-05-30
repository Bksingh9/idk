/**
 * Layer 2 — Stripe wrapper (the ONLY module that imports the Stripe SDK; rule 1).
 *
 * Disabled when STRIPE_SECRET_KEY is unset (Phase 5 wires it). All calls route
 * through the resilience policy and record a usage unit for spend tracking.
 */
import Stripe from "stripe";
import { env, features } from "@/lib/config/env";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/observability/logger";
import { recordUsage } from "@/lib/observability/metrics";
import { withResilience } from "@/lib/resilience/with-resilience";

const logger = log("stripe");
const DEP = "stripe";

let stripe: Stripe | null = null;
function client(): Stripe {
  if (!features.stripe) {
    throw new AppError({
      category: "config",
      message: "Stripe is not configured (STRIPE_SECRET_KEY unset)",
      dependency: DEP,
    });
  }
  if (!stripe) {
    stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
      timeout: env.EXTERNAL_CALL_TIMEOUT_MS,
      maxNetworkRetries: 0, // we own retries via withResilience
    });
  }
  return stripe;
}

export const stripeWrapper = {
  enabled: features.stripe,

  /** Verify + parse a webhook event (signature checked here). */
  constructEvent(payload: string | Buffer, signature: string): Stripe.Event {
    return client().webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET!);
  },

  async createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams
  ): Promise<Stripe.Checkout.Session> {
    return withResilience({ dependency: DEP, operation: "checkout.create" }, async () => {
      const s = await client().checkout.sessions.create(params);
      recordUsage(DEP, "checkout.create");
      return s;
    });
  },

  async createPortalSession(
    params: Stripe.BillingPortal.SessionCreateParams
  ): Promise<Stripe.BillingPortal.Session> {
    return withResilience({ dependency: DEP, operation: "portal.create" }, async () => {
      const s = await client().billingPortal.sessions.create(params);
      recordUsage(DEP, "portal.create");
      return s;
    });
  },

  async getSubscription(id: string): Promise<Stripe.Subscription> {
    return withResilience({ dependency: DEP, operation: "subscription.get" }, () =>
      client().subscriptions.retrieve(id)
    );
  },

  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    if (!features.stripe) return { ok: true, detail: "disabled (no key)" };
    try {
      await withResilience({ dependency: DEP, operation: "balance.get", maxRetries: 1 }, () =>
        client().balance.retrieve()
      );
      return { ok: true, detail: "reachable" };
    } catch (e) {
      logger.warn({ err: String(e) }, "stripe health check failed");
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  },
};
