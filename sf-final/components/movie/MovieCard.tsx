// components/movie/MovieCard.tsx
import Link from 'next/link';
import Image from 'next/image';
import { tmdbImage, formatRating, getRatingColor, getYear } from '@/lib/tmdb';
import type { TMDbMovie } from '@/lib/tmdb';

interface MovieCardProps {
  movie: TMDbMovie;
  priority?: boolean;
  showYear?: boolean;
}

export function MovieCard({ movie, priority = false, showYear = true }: MovieCardProps) {
  const posterUrl = tmdbImage.poster(movie.poster_path, 'w342');
  const rating = formatRating(movie.vote_average);
  const year = getYear(movie.release_date);
  const ratingColor = getRatingColor(movie.vote_average);

  return (
    <Link href={`/movie/${movie.id}`} className="group block" prefetch={false}>
      <div className="poster bg-surface-800 shadow-lg transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:shadow-black/60">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={`${movie.title} poster`}
            fill
            sizes="(max-width: 640px) 150px, (max-width: 1024px) 160px, 180px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-700">
            <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
        )}

        {/* Rating badge */}
        {movie.vote_count > 10 && (
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-xs font-mono font-medium flex items-center gap-1">
            <svg className="w-3 h-3 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className={ratingColor}>{rating}</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
          <span className="text-xs font-medium text-brand-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Where to Watch
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="mt-2.5 space-y-0.5 px-0.5">
        <p className="text-sm font-medium text-white leading-tight line-clamp-1 group-hover:text-brand-400 transition-colors">
          {movie.title}
        </p>
        {showYear && year !== 'N/A' && (
          <p className="text-xs text-slate-500">{year}</p>
        )}
      </div>
    </Link>
  );
}

/** Loading skeleton for movie card */
export function MovieCardSkeleton() {
  return (
    <div>
      <div className="skeleton rounded-lg" style={{ aspectRatio: '2/3' }} />
      <div className="mt-2.5 space-y-1.5">
        <div className="skeleton h-3.5 w-4/5 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
      </div>
    </div>
  );
}
