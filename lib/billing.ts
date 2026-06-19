// lib/billing.ts
// Unified billing layer supporting both Stripe (USD) and Razorpay (INR)

// ─── Plan definitions ─────────────────────────────────────────────────────────

export interface PlanConfig {
  id: string;           // matches SubscriptionPlan enum
  name: string;
  description: string;
  features: string[];
  prices: {
    usd: { monthly: number; stripePriceId?: string };  // in cents
    inr: { monthly: number; razorpayPlanId?: string };  // in paise
  };
}

export const PLANS: PlanConfig[] = [
  {
    id: 'CRITIC_PRO',
    name: 'Critic Pro',
    description: 'For movie reviewers who want to grow their audience',
    features: [
      'Verified Critic badge on profile',
      'Custom affiliate link (10% commission)',
      'Affiliate dashboard & earnings tracker',
      'Featured in "Top Critics" section',
      'Priority review approval',
    ],
    prices: {
      usd: { monthly: 300,  stripePriceId:    process.env.STRIPE_CRITIC_PRICE_ID },
      inr: { monthly: 19900, razorpayPlanId:  process.env.RAZORPAY_CRITIC_PLAN_ID },
    },
  },
  {
    id: 'CREATOR_PRO',
    name: 'Creator Pro',
    description: 'For filmmakers, actors & crew seeking opportunities',
    features: [
      'Verified Creator badge',
      '"Available for Work" tag on profile',
      'Public Agent / Contact button',
      'Showreel link on profile',
      'IMDb profile link',
      'Priority placement in crew search',
    ],
    prices: {
      usd: { monthly: 600,  stripePriceId:   process.env.STRIPE_CREATOR_PRICE_ID },
      inr: { monthly: 49900, razorpayPlanId: process.env.RAZORPAY_CREATOR_PLAN_ID },
    },
  },
  {
    id: 'STUDIO',
    name: 'Studio',
    description: 'For production companies wanting to promote their work',
    features: [
      'Homepage spotlight placement',
      'Genre page banner',
      'Trailer embed on platform',
      'Crowdfunding campaign promotion',
      'Analytics dashboard (impressions, clicks)',
      'Priority customer support',
    ],
    prices: {
      usd: { monthly: 3500,  stripePriceId:   process.env.STRIPE_STUDIO_PRICE_ID },
      inr: { monthly: 299900, razorpayPlanId: process.env.RAZORPAY_STUDIO_PLAN_ID },
    },
  },
];

export function getPlan(planId: string): PlanConfig | undefined {
  return PLANS.find(p => p.id === planId);
}

export function formatPrice(
  plan: PlanConfig,
  currency: 'usd' | 'inr'
): string {
  if (currency === 'inr') {
    const paise = plan.prices.inr.monthly;
    return `₹${(paise / 100).toFixed(0)}/mo`;
  }
  const cents = plan.prices.usd.monthly;
  return `$${(cents / 100).toFixed(2)}/mo`;
}

// ─── Stripe helpers ───────────────────────────────────────────────────────────

export async function createStripeCheckout(params: {
  planId: string;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

  const plan = getPlan(params.planId);
  if (!plan?.prices.usd.stripePriceId) throw new Error('Stripe price not configured');

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: plan.prices.usd.stripePriceId, quantity: 1 }],
    customer_email: params.userEmail,
    metadata: { userId: params.userId, planId: params.planId },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return session.url!;
}

// ─── Razorpay helpers ─────────────────────────────────────────────────────────

export async function createRazorpaySubscription(params: {
  planId: string;
  userId: string;
  userEmail: string;
  userName: string;
}): Promise<{
  subscriptionId: string;
  keyId: string;
  amount: number;
  currency: string;
}> {
  const Razorpay = (await import('razorpay')).default;
  const razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  const plan = getPlan(params.planId);
  if (!plan?.prices.inr.razorpayPlanId) throw new Error('Razorpay plan not configured');

  const subscription = await razorpay.subscriptions.create({
    plan_id:       plan.prices.inr.razorpayPlanId,
    customer_notify: 1,
    total_count:   12,         // up to 12 monthly payments
    notes: {
      userId: params.userId,
      planId: params.planId,
    },
  });

  return {
    subscriptionId: subscription.id,
    keyId: process.env.RAZORPAY_KEY_ID!,
    amount: plan.prices.inr.monthly,
    currency: 'INR',
  };
}

// ─── Webhook verification ─────────────────────────────────────────────────────

export async function verifyStripeWebhook(
  body: string,
  signature: string
) {
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });
  return stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}

import crypto from 'crypto';

export function verifyRazorpayWebhook(body: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');
  return expected === signature;
}
