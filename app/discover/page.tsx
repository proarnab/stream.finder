// app/discover/page.tsx
import type { Metadata } from 'next';
import { discoverByGenre, getTrending, getTopRated, getGenres } from '@/lib/tmdb';
import { MovieCard } from '@/components/movie/MovieCard';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Discover Movies — Browse All Genres',
  description: 'Browse movies by genre and find where to watch them online legally.',
};

export const revalidate = 3600;

interface Props {
  searchParams: { genre?: string; sort?: string; page?: string };
}

const GENRE_NAMES: Record<number, string> = {
  28: 'Action', 35: 'Comedy', 18: 'Drama', 27: 'Horror',
  878: 'Sci-Fi', 53: 'Thriller', 99: 'Documentary', 16: 'Animation',
  10749: 'Romance', 80: 'Crime', 10751: 'Family', 12: 'Adventure',
  9648: 'Mystery', 14: 'Fantasy', 36: 'History', 10752: 'War',
};

export default async function DiscoverPage({ searchParams }: Props) {
  const genreId = searchParams.genre ? parseInt(searchParams.genre, 10) : null;
  const sort = searchParams.sort ?? 'popularity';
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10));

  let moviesResult;
  try {
    if (genreId) {
      moviesResult = await discoverByGenre(genreId, page);
    } else if (sort === 'top_rated') {
      moviesResult = await getTopRated(page);
    } else if (sort === 'trending') {
      moviesResult = await getTrending('week');
    } else {
      moviesResult = await getTrending('week');
    }
  } catch {
    moviesResult = { results: [], total_pages: 1, total_results: 0, page: 1 };
  }

  const movies = moviesResult.results;
  const totalPages = Math.min(moviesResult.total_pages ?? 1, 20);
  const currentGenreName = genreId ? GENRE_NAMES[genreId] : null;

  const title = currentGenreName
    ? `${currentGenreName} Movies`
    : sort === 'top_rated' ? 'Top Rated Movies' : 'Trending Movies';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
      {/* Header */}
      <div className="mb-8">
        <p className="section-label mb-1">Browse Library</p>
        <h1 className="section-title">{title}</h1>
      </div>

      {/* Genre filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href="/discover"
          className={`genre-pill ${!genreId && sort !== 'top_rated' ? 'bg-brand-500/15 border-brand-500/40 text-brand-400' : ''}`}
        >
          Trending
        </Link>
        <Link
          href="/discover?sort=top_rated"
          className={`genre-pill ${sort === 'top_rated' && !genreId ? 'bg-brand-500/15 border-brand-500/40 text-brand-400' : ''}`}
        >
          Top Rated
        </Link>
        {Object.entries(GENRE_NAMES).map(([id, name]) => (
          <Link
            key={id}
            href={`/discover?genre=${id}`}
            className={`genre-pill ${String(genreId) === id ? 'bg-brand-500/15 border-brand-500/40 text-brand-400' : ''}`}
          >
            {name}
          </Link>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-12">
              {page > 1 && (
                <Link
                  href={`/discover?${genreId ? `genre=${genreId}` : `sort=${sort}`}&page=${page - 1}`}
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
                  href={`/discover?${genreId ? `genre=${genreId}` : `sort=${sort}`}&page=${page + 1}`}
                  className="btn-ghost"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 text-slate-500">No movies found.</div>
      )}
    </div>
  );
}
