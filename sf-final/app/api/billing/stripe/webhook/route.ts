// app/api/billing/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyStripeWebhook } from '@/lib/billing';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature') ?? '';

  let event;
  try {
    event = await verifyStripeWebhook(body, sig);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as {
        metadata?: { userId?: string; planId?: string };
        customer?: string;
        subscription?: string;
        current_period_start?: number;
        current_period_end?: number;
      };
      const { userId, planId } = s.metadata ?? {};
      if (!userId || !planId) break;

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan:    planId as never,
          status:  'ACTIVE',
          currency: 'USD',
          amount:  0,
          stripeCustomerId:       s.customer as string,
          stripeSubscriptionId:   s.subscription as string,
          currentPeriodStart: new Date(),
          currentPeriodEnd:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        update: {
          plan:    planId as never,
          status:  'ACTIVE',
          stripeCustomerId:       s.customer as string,
          stripeSubscriptionId:   s.subscription as string,
          currentPeriodStart: new Date(),
          currentPeriodEnd:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Upgrade role if needed
      if (planId === 'CRITIC_PRO') {
        await prisma.user.update({ where: { id: userId }, data: { role: 'CRITIC' } });
      }
      if (planId === 'CREATOR_PRO') {
        await prisma.user.update({ where: { id: userId }, data: { role: 'CREATOR' } });
      }

      // Auto-create affiliate code for Critics
      if (planId === 'CRITIC_PRO') {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          const slug = (user.name ?? userId).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          await prisma.affiliateCode.upsert({
            where: { userId },
            create: { userId, code: `${slug}-sf`, commission: 0.10 },
            update: {},
          });
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as { id: string };
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: { status: 'CANCELED' },
      });
      break;
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as { subscription?: string };
      if (inv.subscription) {
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: inv.subscription as string },
          data: { status: 'PAST_DUE' },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
