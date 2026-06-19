// components/ui/AdSlot.tsx
// Renders Google AdSense ads when publisher ID is configured,
// otherwise shows a clean placeholder so layout is preserved during development.
'use client';
import { useEffect, useRef } from 'react';

interface AdSlotProps {
  slotId?: string;
  format?: 'auto' | 'rectangle' | 'vertical' | 'horizontal';
  className?: string;
  label?: string;
  /** Minimum height to reserve (prevents layout shift) */
  minHeight?: number;
}

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export function AdSlot({
  slotId,
  format = 'auto',
  className = '',
  label = 'Advertisement',
  minHeight = 90,
}: AdSlotProps) {
  const publisherId = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID;
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!publisherId || !slotId || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (e) {
      console.warn('AdSense push error:', e);
    }
  }, [publisherId, slotId]);

  // Development / no ad config — show placeholder
  if (!publisherId || !slotId) {
    return (
      <div
        className={`ad-slot text-center ${className}`}
        style={{ minHeight }}
        aria-label="Ad placement"
        role="complementary"
      >
        <span className="opacity-40">{label}</span>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${className}`} style={{ minHeight }}>
      <ins
        ref={adRef}
        className="adsbygoogle block"
        data-ad-client={publisherId}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive="true"
        style={{ display: 'block' }}
      />
    </div>
  );
}
