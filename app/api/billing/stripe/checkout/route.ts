// app/api/billing/stripe/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createStripeCheckout } from '@/lib/billing';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { planId } = await req.json();
  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL;

  try {
    const url = await createStripeCheckout({
      planId,
      userId: session.user.id,
      userEmail: session.user.email!,
      successUrl: `${origin}/profile?subscribed=true`,
      cancelUrl:  `${origin}/pricing`,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
