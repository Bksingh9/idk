/**
 * Phase 5 — billing/plans.
 *
 * Plans: free (1 active project), indie (5), studio (unlimited + priority
 * matching). Project creation is gated by the developer's plan. Stripe handles
 * checkout/portal; a webhook syncs subscription status onto the profile.
 *
 * Everything degrades gracefully when Stripe isn't configured (features.stripe
 * false): gating still works (everyone is effectively 'free'), and the
 * checkout/portal endpoints report that billing is unavailable.
 */
import type Stripe from "stripe";
import { collections, type PlanTier } from "@/db/collections";
import { withMongo } from "@/lib/wrappers/mongo";
import { env, features } from "@/lib/config/env";
import { AppError } from "@/lib/errors";
import { stripeWrapper } from "@/lib/wrappers/stripe";
import { log } from "@/lib/observability/logger";

const logger = log("billing");

export const PLAN_LIMITS: Record<PlanTier, number> = {
  free: 1,
  indie: 5,
  studio: Infinity,
};

/** Studio gets a larger matching fan-out ("priority matching"). */
export function inviteCapForPlan(plan: PlanTier): number {
  return plan === "studio" ? 40 : 20;
}

function priceToPlan(priceId: string | undefined): PlanTier | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_INDIE) return "indie";
  if (priceId === env.STRIPE_PRICE_STUDIO) return "studio";
  return null;
}

function planToPrice(plan: "indie" | "studio"): string {
  const price = plan === "indie" ? env.STRIPE_PRICE_INDIE : env.STRIPE_PRICE_STUDIO;
  if (!price) {
    throw new AppError({ category: "config", message: `no Stripe price configured for ${plan}` });
  }
  return price;
}

export interface PlanStatus {
  plan: PlanTier;
  limit: number;
  activeProjects: number;
  canCreate: boolean;
  subscriptionStatus: string | null;
}

export async function getPlanStatus(developerId: string): Promise<PlanStatus> {
  const profile = await withMongo("billing.profile", () =>
    collections.profiles().findOne({ _id: developerId })
  );
  const plan = (profile?.plan ?? "free") as PlanTier;
  const activeProjects = await withMongo("billing.activeCount", () =>
    collections.projects().countDocuments({ developerId, status: "open" })
  );
  const limit = PLAN_LIMITS[plan];
  return {
    plan,
    limit,
    activeProjects,
    canCreate: activeProjects < limit,
    subscriptionStatus: profile?.subscriptionStatus ?? null,
  };
}

/** Throws a clean error if the developer is at their active-project limit. */
export async function assertCanCreateProject(developerId: string): Promise<void> {
  const status = await getPlanStatus(developerId);
  if (!status.canCreate) {
    throw new AppError({
      category: "forbidden",
      message:
        status.plan === "free"
          ? "Free plan allows 1 active project. Upgrade or close a project to post more."
          : `Your ${status.plan} plan allows ${status.limit} active projects. Upgrade or close one.`,
    });
  }
}

async function ensureCustomer(developerId: string): Promise<string> {
  const profile = await withMongo("billing.custProfile", () =>
    collections.profiles().findOne({ _id: developerId })
  );
  if (profile?.stripeCustomerId) return profile.stripeCustomerId;

  const user = await withMongo("billing.custUser", () =>
    collections.users().findOne({ _id: developerId })
  );
  const customer = await stripeWrapper.createCustomer({
    email: user?.email,
    metadata: { developerId },
  });
  await withMongo("billing.saveCustomer", () =>
    collections.profiles().updateOne({ _id: developerId }, { $set: { stripeCustomerId: customer.id } })
  );
  return customer.id;
}

export async function startCheckout(
  developerId: string,
  plan: "indie" | "studio"
): Promise<string> {
  if (!features.stripe) {
    throw new AppError({ category: "config", message: "billing is not configured" });
  }
  const customerId = await ensureCustomer(developerId);
  const session = await stripeWrapper.createCheckoutSession({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: planToPrice(plan), quantity: 1 }],
    success_url: `${env.APP_BASE_URL}/billing?status=success`,
    cancel_url: `${env.APP_BASE_URL}/billing?status=cancelled`,
    metadata: { developerId, plan },
  });
  if (!session.url) throw new AppError({ category: "upstream_unavailable", message: "no checkout url" });
  return session.url;
}

export async function startPortal(developerId: string): Promise<string> {
  if (!features.stripe) {
    throw new AppError({ category: "config", message: "billing is not configured" });
  }
  const customerId = await ensureCustomer(developerId);
  const session = await stripeWrapper.createPortalSession({
    customer: customerId,
    return_url: `${env.APP_BASE_URL}/billing`,
  });
  return session.url;
}

/** Sync subscription state onto the developer's profile from a webhook event. */
export async function applyWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const active = sub.status === "active" || sub.status === "trialing";
      const priceId = sub.items.data[0]?.price?.id;
      const plan: PlanTier =
        event.type === "customer.subscription.deleted" || !active
          ? "free"
          : priceToPlan(priceId) ?? "free";

      const res = await withMongo("billing.syncSub", () =>
        collections.profiles().updateOne(
          { stripeCustomerId: customerId },
          {
            $set: {
              plan,
              stripeSubscriptionId: sub.id,
              subscriptionStatus: sub.status,
              planCurrentPeriodEnd: new Date(sub.current_period_end * 1000),
            },
          }
        )
      );
      logger.info(
        { type: event.type, customerId, plan, matched: res.matchedCount },
        "subscription synced"
      );
      break;
    }
    default:
      logger.debug({ type: event.type }, "unhandled stripe event");
  }
}
