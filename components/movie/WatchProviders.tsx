// components/movie/WatchProviders.tsx
'use client';
import { useState } from 'react';
import Image from 'next/image';
import { tmdbImage, injectAffiliateLink, FREE_PROVIDER_IDS } from '@/lib/tmdb';
import type { TMDbWatchProvider } from '@/lib/tmdb';
import { AdSlot } from '@/components/ui/AdSlot';

interface WatchProvidersProps {
  providers: {
    link: string;
    flatrate?: TMDbWatchProvider[];
    free?: TMDbWatchProvider[];
    ads?: TMDbWatchProvider[];
    rent?: TMDbWatchProvider[];
    buy?: TMDbWatchProvider[];
  } | null;
  movieTitle: string;
}

function ProviderButton({
  provider,
  type,
  baseLink,
}: {
  provider: TMDbWatchProvider;
  type: 'free' | 'subscription' | 'rent' | 'buy';
  baseLink: string;
}) {
  const logoUrl = tmdbImage.logo(provider.logo_path, 'w92');
  const affiliateUrl = injectAffiliateLink(baseLink, provider.provider_name);

  const typeConfig = {
    free:         { badge: 'Free',         badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
    subscription: { badge: 'Streaming',    badgeClass: 'bg-blue-500/15    text-blue-400    border-blue-500/20'    },
    rent:         { badge: 'Rent',         badgeClass: 'bg-yellow-500/15  text-yellow-400  border-yellow-500/20'  },
    buy:          { badge: 'Buy',          badgeClass: 'bg-purple-500/15  text-purple-400  border-purple-500/20'  },
  };

  const { badge, badgeClass } = typeConfig[type];

  return (
    <a
      href={affiliateUrl}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`provider-btn ${type === 'free' ? 'provider-btn-free' : ''} group`}
      aria-label={`Watch on ${provider.provider_name} — ${badge}`}
    >
      {/* Provider logo */}
      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-surface-600 flex items-center justify-center">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={provider.provider_name}
            width={36} height={36}
            className="object-cover rounded-md"
          />
        ) : (
          <span className="text-xs font-bold text-slate-400">
            {provider.provider_name.substring(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      {/* Provider name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate group-hover:text-brand-300 transition-colors">
          {provider.provider_name}
        </p>
        <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded border ${badgeClass}`}>
          {badge}
        </span>
      </div>

      {/* Arrow */}
      <svg className="w-4 h-4 text-slate-600 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all flex-shrink-0"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

export function WatchProviders({ providers, movieTitle }: WatchProvidersProps) {
  const [activeTab, setActiveTab] = useState<'free' | 'paid'>('free');

  if (!providers) {
    return (
      <div className="card p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-surface-700 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-slate-400 text-sm font-medium">Not available in your region</p>
        <p className="text-slate-600 text-xs mt-1">Try checking your country settings</p>
      </div>
    );
  }

  // Merge free + ads providers, deduplicate
  const freeProviders = [
    ...(providers.free ?? []),
    ...(providers.ads ?? []),
  ].filter((p, idx, arr) => arr.findIndex(x => x.provider_id === p.provider_id) === idx);

  const subscriptionProviders = providers.flatrate ?? [];
  const rentProviders = providers.rent ?? [];
  const buyProviders = providers.buy ?? [];

  const hasFree = freeProviders.length > 0;
  const hasPaid = subscriptionProviders.length > 0 || rentProviders.length > 0 || buyProviders.length > 0;

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex p-1 bg-surface-900 rounded-xl gap-1">
        <button
          onClick={() => setActiveTab('free')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
            activeTab === 'free'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Watch Free (With Ads)
          {hasFree && (
            <span className="bg-emerald-600/40 text-emerald-200 text-xs px-1.5 rounded-full">
              {freeProviders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('paid')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
            activeTab === 'paid'
              ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.902L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Rent / Buy
          {hasPaid && (
            <span className="bg-brand-600/40 text-brand-200 text-xs px-1.5 rounded-full">
              {subscriptionProviders.length + rentProviders.length + buyProviders.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab A — Free streaming */}
      {activeTab === 'free' && (
        <div className="space-y-2 animate-fade-in">
          {hasFree ? (
            freeProviders.map(provider => (
              <ProviderButton
                key={provider.provider_id}
                provider={provider}
                type="free"
                baseLink={providers.link}
              />
            ))
          ) : (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">No free streaming options available right now.</p>
              <p className="text-xs mt-1 text-slate-600">Check the Rent/Buy tab for premium options.</p>
            </div>
          )}

          {/* Ad slot — below free providers */}
          <div className="pt-2">
            <AdSlot
              slotId={process.env.NEXT_PUBLIC_AD_SLOT_BELOW_PROVIDERS}
              format="rectangle"
              label="Advertisement"
              minHeight={120}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Tab B — Rent/Buy */}
      {activeTab === 'paid' && (
        <div className="space-y-4 animate-fade-in">
          {/* Subscription */}
          {subscriptionProviders.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-mono mb-2 px-1">
                Subscription
              </p>
              <div className="space-y-2">
                {subscriptionProviders.map(provider => (
                  <ProviderButton
                    key={provider.provider_id}
                    provider={provider}
                    type="subscription"
                    baseLink={providers.link}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Rent */}
          {rentProviders.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-mono mb-2 px-1">
                Rent
              </p>
              <div className="space-y-2">
                {rentProviders.map(provider => (
                  <ProviderButton
                    key={provider.provider_id}
                    provider={provider}
                    type="rent"
                    baseLink={injectAffiliateLink(providers.link, provider.provider_name)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Buy */}
          {buyProviders.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-mono mb-2 px-1">
                Buy / Own
              </p>
              <div className="space-y-2">
                {buyProviders.map(provider => (
                  <ProviderButton
                    key={provider.provider_id}
                    provider={provider}
                    type="buy"
                    baseLink={injectAffiliateLink(providers.link, provider.provider_name)}
                  />
                ))}
              </div>
            </div>
          )}

          {!hasPaid && (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">No rental or purchase options currently available.</p>
            </div>
          )}

          {/* Affiliate disclosure */}
          <p className="text-[10px] text-slate-600 pt-1 px-1 leading-relaxed">
            * Some links may contain affiliate tracking parameters. We may earn a commission at no extra cost to you.
          </p>
        </div>
      )}

      {/* JustWatch attribution (required by TMDb terms) */}
      <p className="text-[10px] text-slate-700 text-center pt-1">
        Streaming data provided by{' '}
        <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer"
          className="underline hover:text-slate-500">JustWatch</a>{' '}
        via the{' '}
        <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer"
          className="underline hover:text-slate-500">TMDb API</a>
      </p>
    </div>
  );
}
