// app/search/page.tsx
import type { Metadata } from 'next';
import { searchMovies } from '@/lib/tmdb';
import { MovieCard } from '@/components/movie/MovieCard';
import Link from 'next/link';

interface Props {
  searchParams: { q?: string; page?: string };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = searchParams.q ?? '';
  return {
    title: q ? `Search results for "${q}"` : 'Search Movies',
    description: q
      ? `Find where to watch "${q}" online legally. Compare streaming services, rental, and purchase options.`
      : 'Search for any movie and find where to watch it legally online.',
    robots: { index: false },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const query = searchParams.q?.trim() ?? '';
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10));

  if (!query) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 text-center">
        <h1 className="text-3xl font-display font-bold text-white mb-4">Search Movies</h1>
        <p className="text-slate-400">Use the search bar above to find any movie.</p>
      </div>
    );
  }

  let results = null;
  try {
    results = await searchMovies(query, page);
  } catch {
    results = null;
  }

  const movies = results?.results ?? [];
  const totalPages = Math.min(results?.total_pages ?? 1, 20);
  const totalResults = results?.total_results ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
      <div className="mb-8">
        <p className="section-label mb-1">Search Results</p>
        <h1 className="section-title">
          Results for &ldquo;<span className="text-brand-400">{query}</span>&rdquo;
        </h1>
        <p className="text-slate-500 text-sm mt-2">
          {totalResults > 0 ? `${totalResults.toLocaleString()} movies found` : 'No results found'}
        </p>
      </div>

      {movies.length > 0 ? (
        <>
          <div className="movie-grid">
            {movies.map((movie, i) => (
              <MovieCard key={movie.id} movie={movie} priority={i < 4} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-12">
              {page > 1 && (
                <Link
                  href={`/search?q=${encodeURIComponent(query)}&page=${page - 1}`}
                  className="btn-ghost"
                >
                  ← Previous
                </Link>
              )}
              <span className="text-sm text-slate-500 px-4">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/search?q=${encodeURIComponent(query)}&page=${page + 1}`}
                  className="btn-ghost"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-surface-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-semibold text-white mb-2">No results found</h2>
          <p className="text-slate-400 text-sm">
            Try a different spelling or check for typos.
          </p>
        </div>
      )}
    </div>
  );
}
