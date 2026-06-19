'use client';
// app/pricing/page.tsx
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PLANS, formatPrice } from '@/lib/billing';

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [currency, setCurrency] = useState<'usd' | 'inr'>('usd');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    if (!session?.user) {
      router.push(`/login?callbackUrl=/pricing`);
      return;
    }
    setLoadingPlan(planId);

    try {
      if (currency === 'usd') {
        // Stripe checkout
        const res  = await fetch('/api/billing/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId }),
        });
        const data = await res.json() as { url?: string; error?: string };
        if (data.url) window.location.href = data.url;
        else alert(data.error ?? 'Failed to start checkout');
      } else {
        // Razorpay modal
        const res  = await fetch('/api/billing/razorpay/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId }),
        });
        const data = await res.json() as {
          subscriptionId?: string; keyId?: string; amount?: number; error?: string
        };
        if (data.error) { alert(data.error); return; }
        openRazorpay(data, planId);
      }
    } catch {
      alert('Something went wrong');
    } finally {
      setLoadingPlan(null);
    }
  };

  const openRazorpay = (data: { subscriptionId?: string; keyId?: string; amount?: number }, planId: string) => {
    // Dynamically load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    document.body.appendChild(script);
    script.onload = () => {
      const options = {
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: 'StreamFinder',
        description: `${planId} Subscription`,
        image: '/icons/icon-128x128.png',
        prefill: { email: session?.user?.email ?? '', name: session?.user?.name ?? '' },
        theme: { color: '#f97316' },
        handler: () => { router.push('/profile?subscribed=true'); },
      };
      // @ts-expect-error — Razorpay is loaded dynamically
      const rzp = new window.Razorpay(options);
      rzp.open();
    };
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
      {/* Header */}
      <div className="text-center mb-12">
        <p className="section-label mb-2">Simple Pricing</p>
        <h1 className="text-4xl font-display font-bold text-white mb-4">
          Upgrade Your Experience
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto">
          For critics who want to grow, creators who want to be found, and studios who want to be seen.
        </p>

        {/* Currency toggle */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <span className={`text-sm ${currency === 'usd' ? 'text-white' : 'text-slate-500'}`}>USD ($)</span>
          <button
            onClick={() => setCurrency(c => c === 'usd' ? 'inr' : 'usd')}
            className={`relative w-12 h-6 rounded-full transition-colors ${currency === 'inr' ? 'bg-brand-500' : 'bg-surface-600'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${currency === 'inr' ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
          <span className={`text-sm ${currency === 'inr' ? 'text-white' : 'text-slate-500'}`}>INR (₹)</span>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan, i) => {
          const isPopular = i === 1;
          const price = formatPrice(plan, currency);
          return (
            <div
              key={plan.id}
              className={`card p-6 flex flex-col relative ${isPopular ? 'border-brand-500/40 shadow-lg shadow-brand-500/10' : ''}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg shadow-brand-500/40">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-5">
                <h2 className="text-xl font-display font-bold text-white">{plan.name}</h2>
                <p className="text-sm text-slate-400 mt-1">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-bold text-white">{price}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingPlan === plan.id}
                className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
                  isPopular
                    ? 'btn-primary justify-center'
                    : 'btn-ghost justify-center'
                }`}
              >
                {loadingPlan === plan.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Processing…
                  </span>
                ) : (
                  `Get ${plan.name}`
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="mt-16 max-w-2xl mx-auto space-y-4">
        <h2 className="text-2xl font-display font-bold text-white text-center mb-6">Common Questions</h2>
        {[
          { q: 'Can I cancel anytime?', a: 'Yes — cancel from your profile at any time. You keep Pro features until the end of the billing period.' },
          { q: 'How does the affiliate commission work?', a: 'Critic Pro members get a unique referral link. You earn 10% of any paid subscription brought in through your link, tracked in your affiliate dashboard.' },
          { q: 'Is my payment secure?', a: 'USD payments go through Stripe (PCI DSS Level 1). INR payments go through Razorpay — both are industry-standard secure processors.' },
          { q: 'What currency will I be charged in?', a: 'Toggle the switch above to choose USD (Stripe) or INR (Razorpay) before clicking Subscribe.' },
        ].map(({ q, a }) => (
          <div key={q} className="card p-5">
            <p className="text-sm font-semibold text-white mb-1">{q}</p>
            <p className="text-sm text-slate-400">{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
