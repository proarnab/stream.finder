// components/sponsored/SpotlightBanner.tsx
import Image from 'next/image';
import Link from 'next/link';
import prisma from '@/lib/prisma';

interface SpotlightBannerProps {
  placement: 'HOMEPAGE_HERO' | 'HOMEPAGE_ROW' | 'GENRE_TOP' | 'MOVIE_PAGE_SIDEBAR';
  genreId?: number;
  className?: string;
}

// Server component — fetches active spotlight from DB
export async function SpotlightBanner({ placement, genreId, className = '' }: SpotlightBannerProps) {
  let spotlight = null;

  try {
    spotlight = await prisma.spotlight.findFirst({
      where: {
        placement,
        isActive: true,
        genreId: genreId ?? null,
        startsAt: { lte: new Date() },
        endsAt:   { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Track impression
    if (spotlight) {
      await prisma.spotlight.update({
        where: { id: spotlight.id },
        data: { impressions: { increment: 1 } },
      });
    }
  } catch {
    // DB not configured yet — silently skip
    return null;
  }

  if (!spotlight) return null;

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-brand-500/20 ${className}`}>
      {/* Sponsored label */}
      <div className="absolute top-3 left-3 z-10">
        <span className="text-[10px] font-mono uppercase tracking-widest bg-black/60 backdrop-blur-sm
                         text-slate-400 border border-white/10 rounded px-2 py-0.5">
          Sponsored
        </span>
      </div>

      {/* Sponsor logo */}
      {spotlight.sponsorLogoUrl && (
        <div className="absolute top-3 right-3 z-10">
          <Image
            src={spotlight.sponsorLogoUrl}
            alt={spotlight.sponsorName}
            width={80} height={30}
            className="object-contain opacity-70"
          />
        </div>
      )}

      {/* Background image */}
      {spotlight.imageUrl ? (
        <div className="relative h-40 md:h-52">
          <Image
            src={spotlight.imageUrl}
            alt={spotlight.title}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        </div>
      ) : (
        <div className="h-40 bg-gradient-to-r from-surface-700 to-surface-800" />
      )}

      {/* Content overlay */}
      <div className="absolute inset-0 flex items-end p-5">
        <div className="flex-1">
          <p className="text-xs text-brand-400 font-medium mb-1">{spotlight.sponsorName}</p>
          <h3 className="text-white font-display font-bold text-lg leading-tight mb-2 line-clamp-2">
            {spotlight.title}
          </h3>
          {spotlight.description && (
            <p className="text-slate-300 text-xs mb-3 line-clamp-2">{spotlight.description}</p>
          )}
          <SpotlightClickTracker id={spotlight.id} ctaUrl={spotlight.ctaUrl} ctaLabel={spotlight.ctaLabel} />
        </div>
      </div>
    </div>
  );
}

// Client component for click tracking
'use client';
function SpotlightClickTracker({
  id,
  ctaUrl,
  ctaLabel,
}: {
  id: string;
  ctaUrl: string;
  ctaLabel: string;
}) {
  const handleClick = async () => {
    // Fire-and-forget click tracking
    fetch(`/api/sponsored/click/${id}`, { method: 'POST' }).catch(() => {});
  };

  return (
    <a
      href={ctaUrl}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={handleClick}
      className="inline-flex items-center gap-2 btn-primary text-sm py-2 px-4"
    >
      {ctaLabel}
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}
