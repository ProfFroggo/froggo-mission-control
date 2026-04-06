/**
 * Stripe billing integration — plan definitions and limit enforcement.
 *
 * Manages subscription plans (free, pro, team), usage limits, checkout
 * session creation, and Stripe webhook processing.
 *
 * Env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL
 */

import Stripe from "stripe";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlanId = "free" | "pro" | "team";

export type ResourceType = "agents" | "tasks_per_day" | "storage_mb" | "members";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Monthly price in USD cents */
  priceMonthly: number;
  /** Stripe Price ID — null for free tier */
  stripePriceId: string | null;
  limits: PlanLimits;
}

export interface PlanLimits {
  agents: number;
  tasks_per_day: number;
  storage_mb: number;
  members: number;
}

export interface LimitCheck {
  allowed: boolean;
  current: number;
  max: number;
  resource: ResourceType;
  plan: PlanId;
}

export interface WorkspaceEntitlement {
  workspaceId: string;
  plan: PlanId;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
}

export interface WebhookResult {
  handled: boolean;
  event: string;
  workspaceId: string | null;
}

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    stripePriceId: null,
    limits: {
      agents: 2,
      tasks_per_day: 50,
      storage_mb: 100,
      members: 1,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 2900, // $29.00
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
    limits: {
      agents: 10,
      tasks_per_day: 500,
      storage_mb: 5_000,
      members: 5,
    },
  },
  team: {
    id: "team",
    name: "Team",
    priceMonthly: 7900, // $79.00
    stripePriceId: process.env.STRIPE_PRICE_TEAM ?? null,
    limits: {
      agents: 50,
      tasks_per_day: 5_000,
      storage_mb: 50_000,
      members: 25,
    },
  },
};

// ---------------------------------------------------------------------------
// Stripe client
// ---------------------------------------------------------------------------

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("Missing required environment variable: STRIPE_SECRET_KEY");
    }
    stripeInstance = new Stripe(key, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return stripeInstance;
}

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: STRIPE_WEBHOOK_SECRET");
  }
  return secret;
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
}

// ---------------------------------------------------------------------------
// Entitlement storage (in-memory placeholder — replaced by DB in production)
// ---------------------------------------------------------------------------

const entitlements = new Map<string, WorkspaceEntitlement>();

function getEntitlement(workspaceId: string): WorkspaceEntitlement {
  const existing = entitlements.get(workspaceId);
  if (existing) return existing;

  // Default to free plan
  const defaultEntitlement: WorkspaceEntitlement = {
    workspaceId,
    plan: "free",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
  };
  entitlements.set(workspaceId, defaultEntitlement);
  return defaultEntitlement;
}

function setEntitlement(entitlement: WorkspaceEntitlement): void {
  entitlements.set(entitlement.workspaceId, entitlement);
}

// ---------------------------------------------------------------------------
// Usage tracking (in-memory placeholder — replaced by DB in production)
// ---------------------------------------------------------------------------

interface UsageCounters {
  agents: number;
  tasks_today: number;
  storage_mb: number;
  members: number;
  last_reset: string; // ISO date string YYYY-MM-DD
}

const usageCounters = new Map<string, UsageCounters>();

function getUsage(workspaceId: string): UsageCounters {
  const today = new Date().toISOString().slice(0, 10);
  const existing = usageCounters.get(workspaceId);

  if (existing) {
    // Reset daily counters if date changed
    if (existing.last_reset !== today) {
      existing.tasks_today = 0;
      existing.last_reset = today;
    }
    return existing;
  }

  const defaults: UsageCounters = {
    agents: 0,
    tasks_today: 0,
    storage_mb: 0,
    members: 1,
    last_reset: today,
  };
  usageCounters.set(workspaceId, defaults);
  return defaults;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether a workspace can use more of a given resource.
 */
export function checkLimit(
  workspaceId: string,
  resource: ResourceType,
): LimitCheck {
  const entitlement = getEntitlement(workspaceId);
  const plan = PLANS[entitlement.plan];
  const usage = getUsage(workspaceId);

  const currentByResource: Record<ResourceType, number> = {
    agents: usage.agents,
    tasks_per_day: usage.tasks_today,
    storage_mb: usage.storage_mb,
    members: usage.members,
  };

  const current = currentByResource[resource];
  const max = plan.limits[resource];

  return {
    allowed: current < max,
    current,
    max,
    resource,
    plan: entitlement.plan,
  };
}

/**
 * Get the current plan for a workspace.
 */
export function getWorkspacePlan(workspaceId: string): PlanDefinition {
  const entitlement = getEntitlement(workspaceId);
  return PLANS[entitlement.plan];
}

/**
 * Create a Stripe Checkout session for upgrading a workspace to a paid plan.
 * Returns the checkout URL.
 */
export async function createCheckoutSession(
  workspaceId: string,
  plan: PlanId,
): Promise<string> {
  if (plan === "free") {
    throw new Error("Cannot create a checkout session for the free plan");
  }

  const planDef = PLANS[plan];
  if (!planDef.stripePriceId) {
    throw new Error(
      `No Stripe Price ID configured for plan "${plan}". Set STRIPE_PRICE_${plan.toUpperCase()} env var.`,
    );
  }

  const stripe = getStripe();
  const appUrl = getAppUrl();

  // Reuse existing Stripe customer if we have one
  const entitlement = getEntitlement(workspaceId);
  let customerId: string = entitlement.stripeCustomerId ?? "";

  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { workspaceId },
    });
    customerId = customer.id;

    // Persist customer ID
    setEntitlement({
      ...entitlement,
      stripeCustomerId: customerId,
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: planDef.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/settings?billing=cancelled`,
    metadata: {
      workspaceId,
      plan,
    },
    subscription_data: {
      metadata: {
        workspaceId,
        plan,
      },
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return session.url;
}

/**
 * Process an incoming Stripe webhook event.
 *
 * Handles: checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted
 */
export async function handleWebhook(
  body: string | Buffer,
  signature: string,
): Promise<WebhookResult> {
  const stripe = getStripe();
  const webhookSecret = getWebhookSecret();

  const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspaceId ?? null;
      const plan = (session.metadata?.plan as PlanId) ?? null;

      if (workspaceId && plan) {
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        setEntitlement({
          workspaceId,
          plan,
          stripeCustomerId:
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id ?? null,
          stripeSubscriptionId: subscriptionId,
          currentPeriodEnd: null, // Will be set by subscription.updated
        });
      }

      return { handled: true, event: event.type, workspaceId };
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const workspaceId = subscription.metadata?.workspaceId ?? null;
      const plan = (subscription.metadata?.plan as PlanId) ?? null;

      if (workspaceId) {
        const entitlement = getEntitlement(workspaceId);
        setEntitlement({
          ...entitlement,
          plan: plan ?? entitlement.plan,
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        });
      }

      return { handled: true, event: event.type, workspaceId };
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const workspaceId = subscription.metadata?.workspaceId ?? null;

      if (workspaceId) {
        // Downgrade to free on cancellation
        setEntitlement({
          workspaceId,
          plan: "free",
          stripeCustomerId: getEntitlement(workspaceId).stripeCustomerId,
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
        });
      }

      return { handled: true, event: event.type, workspaceId };
    }

    default:
      return { handled: false, event: event.type, workspaceId: null };
  }
}
