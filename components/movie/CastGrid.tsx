// components/movie/CastGrid.tsx
import Image from 'next/image';
import { tmdbImage } from '@/lib/tmdb';
import type { TMDbCredits } from '@/lib/tmdb';

interface CastGridProps {
  credits: TMDbCredits;
}

export function CastGrid({ credits }: CastGridProps) {
  const mainCast = credits.cast
    .filter(m => m.profile_path || m.known_for_department === 'Acting')
    .slice(0, 12);

  const director = credits.crew.find(m => m.job === 'Director');
  const writers = credits.crew.filter(m => m.job === 'Screenplay' || m.job === 'Writer').slice(0, 2);

  return (
    <div>
      {/* Director / Writers */}
      {(director || writers.length > 0) && (
        <div className="flex flex-wrap gap-6 mb-8 pb-6 border-b border-white/[0.06]">
          {director && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-mono mb-1">Director</p>
              <p className="text-sm font-medium text-white">{director.name}</p>
            </div>
          )}
          {writers.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-mono mb-1">Screenplay</p>
              <p className="text-sm font-medium text-white">{writers.map(w => w.name).join(', ')}</p>
            </div>
          )}
        </div>
      )}

      {/* Cast grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {mainCast.map((member, i) => {
          const profileUrl = tmdbImage.profile(member.profile_path, 'w185');
          return (
            <div key={`${member.id}-${i}`} className="text-center group">
              <div className="w-full aspect-square rounded-full overflow-hidden bg-surface-700 mb-2 mx-auto
                              ring-2 ring-transparent group-hover:ring-brand-500/40 transition-all duration-200"
                   style={{ maxWidth: 80 }}
              >
                {profileUrl ? (
                  <Image
                    src={profileUrl}
                    alt={member.name}
                    width={80} height={80}
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-xs font-medium text-white leading-tight line-clamp-1">{member.name}</p>
              <p className="text-[10px] text-slate-500 leading-tight line-clamp-1 mt-0.5">{member.character}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
