// app/api/billing/razorpay/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createRazorpaySubscription } from '@/lib/billing';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { planId } = await req.json();

  try {
    const data = await createRazorpaySubscription({
      planId,
      userId: session.user.id,
      userEmail: session.user.email!,
      userName: session.user.name ?? 'User',
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error('Razorpay error:', err);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}
