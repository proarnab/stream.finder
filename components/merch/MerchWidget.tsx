'use client';
// components/merch/MerchWidget.tsx
import { getMerchItems } from '@/lib/merch';

interface MerchWidgetProps {
  movieTitle: string;
  year: string;
}

export function MerchWidget({ movieTitle, year }: MerchWidgetProps) {
  const items = getMerchItems(movieTitle, year);

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🛒</span>
        <h3 className="font-display font-semibold text-white text-base">
          Own It Physically
        </h3>
      </div>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Buy Blu-rays, posters, merch, and more — affiliate commissions support this site.
      </p>

      <div className="space-y-2">
        {items.map(item => (
          <a
            key={item.type}
            href={item.searchQuery}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
                       bg-surface-700 hover:bg-surface-600 border border-white/[0.06]
                       hover:border-white/[0.14] transition-all duration-200 group"
            aria-label={`${item.label} for ${movieTitle}`}
          >
            <span className="text-base w-6 text-center flex-shrink-0">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white group-hover:text-brand-300 transition-colors truncate">
                {item.label}
              </p>
            </div>
            <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-brand-400 flex-shrink-0 transition-colors"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ))}
      </div>

      <p className="text-[10px] text-slate-700 mt-3 leading-relaxed">
        * Amazon affiliate links. We may earn a commission at no extra cost to you.
      </p>
    </div>
  );
}
