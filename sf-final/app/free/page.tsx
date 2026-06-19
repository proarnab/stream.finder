// app/free/page.tsx
import type { Metadata } from 'next';
import { getFreeStreamingMovies } from '@/lib/tmdb';
import { MovieCard } from '@/components/movie/MovieCard';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Free Movies to Stream Right Now — No Subscription Needed',
  description:
    'Watch movies for free online legally — no subscription, no credit card. Browse free ad-supported movies on Tubi, Pluto TV, Freevee, Peacock, and more.',
  keywords: ['free movies online', 'free streaming movies', 'watch movies free', 'no subscription movies'],
  alternates: { canonical: '/free' },
};

export const revalidate = 3600;

interface Props {
  searchParams: { page?: string };
}

export default async function FreeMoviesPage({ searchParams }: Props) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10));

  let moviesResult;
  try {
    moviesResult = await getFreeStreamingMovies('US', page);
  } catch {
    moviesResult = { results: [], total_pages: 1, total_results: 0, page: 1 };
  }

  const movies = moviesResult.results;
  const totalPages = Math.min(moviesResult.total_pages ?? 1, 10);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
      {/* Header */}
      <div className="mb-8">
        <p className="section-label text-emerald-400 mb-1">100% Legal &amp; Free</p>
        <h1 className="section-title">Free Movies Streaming Now</h1>
        <p className="text-slate-400 mt-2 max-w-xl">
          These movies are available to watch right now for free with ads on platforms like
          Tubi, Pluto TV, Freevee, and Peacock — no subscription required.
        </p>
      </div>

      {/* Platform info */}
      <div className="flex flex-wrap gap-3 mb-8">
        {['Tubi TV', 'Pluto TV', 'Amazon Freevee', 'Peacock', 'Plex', 'Crackle', 'Kanopy'].map(name => (
          <span key={name} className="genre-pill border-emerald-500/20 text-emerald-400 bg-emerald-500/5">
            {name}
          </span>
        ))}
      </div>

      {/* Grid */}
      {movies.length > 0 ? (
        <>
          <div className="movie-grid">
            {movies.map((movie, i) => (
              <MovieCard key={movie.id} movie={movie} priority={i < 6} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-12">
              {page > 1 && (
                <Link href={`/free?page=${page - 1}`} className="btn-ghost">← Previous</Link>
              )}
              <span className="text-sm text-slate-500 px-4">Page {page} of {totalPages}</span>
              {page < totalPages && (
                <Link href={`/free?page=${page + 1}`} className="btn-ghost">Next →</Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 text-slate-500">
          <p>Unable to load free movies right now. Please try again later.</p>
        </div>
      )}
    </div>
  );
}
