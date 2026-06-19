// app/movie/[id]/page.tsx
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getMovieDetails, getWatchProviders,
  tmdbImage, formatRating, formatRuntime, getRatingColor, getYear,
} from '@/lib/tmdb';
import { WatchProviders }   from '@/components/movie/WatchProviders';
import { CastGrid }         from '@/components/movie/CastGrid';
import { MovieRow }         from '@/components/movie/MovieRow';
import { AdSlot }           from '@/components/ui/AdSlot';
import { MerchWidget }      from '@/components/merch/MerchWidget';
import { WatchlistButton }  from '@/components/movie/WatchlistButton';
import { ReviewSection }    from '@/components/movie/ReviewSection';
import { SemanticSearchBar } from '@/components/search/SemanticSearchBar';

export const revalidate = 86400;

export async function generateStaticParams() {
  const { getTrending } = await import('@/lib/tmdb');
  try {
    const { results } = await getTrending('week');
    return results.slice(0, 20).map(m => ({ id: String(m.id) }));
  } catch { return []; }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const movieId = parseInt(params.id, 10);
  if (isNaN(movieId)) return { title: 'Movie Not Found' };
  try {
    const movie      = await getMovieDetails(movieId);
    const year       = getYear(movie.release_date);
    const posterUrl  = tmdbImage.poster(movie.poster_path, 'w500');
    const backdropUrl = tmdbImage.backdrop(movie.backdrop_path, 'w1280');
    const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://streamfinder.app';
    const title      = `Where to Watch "${movie.title}" (${year}) — Free Streaming & Rentals`;
    const description =
      `Find out where to watch ${movie.title} (${year}) legally online — free streaming, subscription, rental & purchase options. ` +
      (movie.overview ? movie.overview.slice(0, 120) + '…' : '');
    return {
      title, description,
      keywords: [
        `where to watch ${movie.title}`, `${movie.title} streaming`,
        `${movie.title} free online`, `watch ${movie.title} legally`,
        `${movie.title} ${year}`, `is ${movie.title} on Netflix`,
        `${movie.title} rent or buy`,
      ],
      alternates: { canonical: `/movie/${movieId}` },
      openGraph: {
        type: 'video.movie', title, description,
        url: `${siteUrl}/movie/${movieId}`,
        images: backdropUrl ? [
          { url: backdropUrl, width: 1280, height: 720, alt: `${movie.title} backdrop` },
          ...(posterUrl ? [{ url: posterUrl, width: 500, height: 750 }] : []),
        ] : [],
      },
      twitter: { card: 'summary_large_image', title, description, images: backdropUrl ? [backdropUrl] : [] },
    };
  } catch { return { title: 'Movie Not Found' }; }
}

export default async function MoviePage({ params }: { params: { id: string } }) {
  const movieId = parseInt(params.id, 10);
  if (isNaN(movieId)) notFound();

  const [movieResult, providersResult] = await Promise.allSettled([
    getMovieDetails(movieId),
    getWatchProviders(movieId, process.env.NEXT_PUBLIC_DEFAULT_COUNTRY ?? 'US'),
  ]);

  if (movieResult.status === 'rejected') notFound();

  const movie     = movieResult.value;
  const providers = providersResult.status === 'fulfilled' ? providersResult.value : null;

  const backdropUrl = tmdbImage.backdrop(movie.backdrop_path, 'w1280');
  const posterUrl   = tmdbImage.poster(movie.poster_path, 'w500');
  const year        = getYear(movie.release_date);
  const rating      = formatRating(movie.vote_average);
  const ratingColor = getRatingColor(movie.vote_average);
  const trailer     = movie.videos?.results.find(v => v.type === 'Trailer' && v.site === 'YouTube' && v.official)
                   ?? movie.videos?.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    description: movie.overview,
    datePublished: movie.release_date,
    image: posterUrl,
    aggregateRating: movie.vote_count > 10 ? {
      '@type': 'AggregateRating',
      ratingValue: movie.vote_average.toFixed(1),
      bestRating: '10',
      ratingCount: movie.vote_count,
    } : undefined,
    director: movie.credits?.crew.find(m => m.job === 'Director')
      ? { '@type': 'Person', name: movie.credits.crew.find(m => m.job === 'Director')!.name }
      : undefined,
    actor: movie.credits?.cast.slice(0, 5).map(a => ({ '@type': 'Person', name: a.name })),
    genre: movie.genres?.map(g => g.name),
    duration: movie.runtime ? `PT${movie.runtime}M` : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[70vh] flex items-end overflow-hidden">
        {backdropUrl && (
          <div className="absolute inset-0">
            <Image src={backdropUrl} alt={`${movie.title} backdrop`} fill className="object-cover" priority quality={85} />
            <div className="absolute inset-0 hero-gradient" />
            <div className="absolute inset-0 bg-gradient-to-r from-surface-950/90 via-surface-950/40 to-transparent" />
          </div>
        )}

        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-10 pt-28">
          {/* Ad above title */}
          <div className="mb-6">
            <AdSlot slotId={process.env.NEXT_PUBLIC_AD_SLOT_HEADER} format="horizontal" minHeight={60} className="max-w-2xl" />
          </div>

          <div className="flex flex-col sm:flex-row gap-6 lg:gap-8 items-start">
            {/* Poster */}
            {posterUrl && (
              <div className="hidden sm:block flex-shrink-0 w-44 lg:w-52 animate-fade-up">
                <div className="poster rounded-xl shadow-2xl shadow-black/60 ring-1 ring-white/10">
                  <Image src={posterUrl} alt={`${movie.title} poster`} fill
                    sizes="(max-width: 1024px) 176px, 208px" className="object-cover" priority />
                </div>
              </div>
            )}

            {/* Info */}
            <div className="flex-1 animate-fade-up stagger-1">
              <div className="flex flex-wrap gap-2 mb-3">
                {movie.genres?.map(g => (
                  <Link key={g.id} href={`/discover?genre=${g.id}`} className="genre-pill">{g.name}</Link>
                ))}
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white leading-tight mb-2">
                {movie.title}
              </h1>
              {movie.tagline && (
                <p className="text-slate-400 italic mb-3 text-lg">&ldquo;{movie.tagline}&rdquo;</p>
              )}

              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="rating-badge">
                  <svg className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className={ratingColor}>{rating}</span>
                  <span className="text-slate-500 text-xs">/ 10</span>
                </span>
                <span className="text-slate-400 text-sm">{year}</span>
                {movie.runtime ? <span className="text-slate-400 text-sm">{formatRuntime(movie.runtime)}</span> : null}
                {movie.status && movie.status !== 'Released' && (
                  <span className="text-xs px-2 py-0.5 bg-brand-500/20 text-brand-400 rounded-full border border-brand-500/30">{movie.status}</span>
                )}
              </div>

              <p className="text-slate-300 leading-relaxed max-w-2xl text-base">{movie.overview}</p>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 mt-5">
                {trailer && (
                  <a href={`https://www.youtube.com/watch?v=${trailer.key}`} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                    <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    Trailer
                  </a>
                )}
                <WatchlistButton
                  movieId={movie.id}
                  movieTitle={movie.title}
                  posterPath={movie.poster_path}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 xl:gap-12">

          {/* ── Left / Main ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-12">

            {/* Cast */}
            {movie.credits?.cast?.length > 0 && (
              <section>
                <p className="section-label mb-1">The Talent</p>
                <h2 className="section-title mb-6">Cast &amp; Crew</h2>
                <CastGrid credits={movie.credits} />
              </section>
            )}

            {/* Community reviews */}
            <ReviewSection movieId={movie.id} movieTitle={movie.title} />

            {/* Similar movies */}
            {movie.similar?.results?.length > 0 && (
              <MovieRow label="You Might Also Like" title="Similar Movies" movies={movie.similar.results} />
            )}

            {/* Search bar — re-engage users */}
            <div className="card p-6">
              <p className="text-sm font-medium text-slate-400 mb-3">Looking for something else?</p>
              <SemanticSearchBar placeholder='Try "thriller directed by Nolan" or "free horror 2023"' />
            </div>
          </div>

          {/* ── Right Sidebar ────────────────────────────────────────────── */}
          <aside className="space-y-5">
            {/* Watch Now widget */}
            <div className="card p-5 sticky top-20">
              <h2 className="font-display font-semibold text-white text-lg mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Where to Watch
              </h2>
              <WatchProviders providers={providers} movieTitle={movie.title} />
            </div>

            {/* Sidebar ad */}
            <AdSlot slotId={process.env.NEXT_PUBLIC_AD_SLOT_SIDEBAR} format="rectangle" minHeight={250} className="w-full" />

            {/* Merch widget */}
            <MerchWidget movieTitle={movie.title} year={year} />

            {/* Movie details */}
            <div className="card p-5 space-y-3">
              <h3 className="font-display font-semibold text-white text-base mb-4">Movie Details</h3>
              {[
                { label: 'Original Title', value: movie.original_title !== movie.title ? movie.original_title : null },
                { label: 'Release Date', value: movie.release_date ? new Date(movie.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null },
                { label: 'Runtime', value: movie.runtime ? formatRuntime(movie.runtime) : null },
                { label: 'Status', value: movie.status },
                { label: 'Language', value: movie.spoken_languages?.[0]?.english_name },
                { label: 'Country', value: movie.production_countries?.[0]?.name },
                { label: 'TMDb Rating', value: movie.vote_count > 10 ? `${rating}/10 (${movie.vote_count.toLocaleString()} votes)` : null },
                { label: 'Budget', value: movie.budget && movie.budget > 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(movie.budget) : null },
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm gap-4">
                  <span className="text-slate-500 shrink-0">{label}</span>
                  <span className="text-slate-300 text-right">{value}</span>
                </div>
              ))}
              <div className="pt-2 flex flex-wrap gap-2 border-t border-white/[0.06]">
                {movie.imdb_id && (
                  <a href={`https://www.imdb.com/title/${movie.imdb_id}`} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs py-1.5 px-3">IMDb ↗</a>
                )}
                <a href={`https://www.themoviedb.org/movie/${movie.id}`} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs py-1.5 px-3">TMDb ↗</a>
                {movie.homepage && (
                  <a href={movie.homepage} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs py-1.5 px-3">Official ↗</a>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
