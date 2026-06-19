// components/movie/MovieRow.tsx
import Link from 'next/link';
import { MovieCard } from './MovieCard';
import type { TMDbMovie } from '@/lib/tmdb';

interface MovieRowProps {
  title: string;
  label?: string;
  movies: TMDbMovie[];
  viewAllHref?: string;
  priority?: boolean;
}

export function MovieRow({ title, label, movies, viewAllHref, priority = false }: MovieRowProps) {
  if (!movies?.length) return null;

  return (
    <section>
      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          {label && <p className="section-label">{label}</p>}
          <h2 className="section-title">{title}</h2>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors shrink-0 ml-4"
          >
            View all
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>

      {/* Horizontal scroll row */}
      <div className="scroll-row">
        {movies.slice(0, 16).map((movie, i) => (
          <div key={movie.id} className="w-[148px] sm:w-[160px] lg:w-[175px]">
            <MovieCard movie={movie} priority={priority && i < 3} />
          </div>
        ))}
      </div>
    </section>
  );
}
