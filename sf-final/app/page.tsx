// app/page.tsx
import type { Metadata } from 'next';
import { getTrending, getFreeStreamingMovies, getTopRated, discoverByGenre, GENRES } from '@/lib/tmdb';
import { HeroSearch }     from '@/components/movie/HeroSearch';
import { MovieRow }       from '@/components/movie/MovieRow';
import { AdSlot }         from '@/components/ui/AdSlot';
import { SemanticSearchBar } from '@/components/search/SemanticSearchBar';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'StreamFinder — Find Where to Watch Any Movie Free Online',
  description: 'Discover where to watch any movie online legally. Free streaming, subscriptions, rentals. Updated daily.',
  alternates: { canonical: '/' },
};

export const revalidate = 3600;

export default async function HomePage() {
  const [trending, freeMovies, topRated, actionMovies, horrorMovies, scifiMovies] = await Promise.allSettled([
    getTrending('week'),
    getFreeStreamingMovies('US'),
    getTopRated(),
    discoverByGenre(GENRES.ACTION),
    discoverByGenre(GENRES.HORROR),
    discoverByGenre(GENRES.SCIFI),
  ]);

  const trendingMovies     = trending.status     === 'fulfilled' ? trending.value.results     : [];
  const freeStreamMovies   = freeMovies.status   === 'fulfilled' ? freeMovies.value.results   : [];
  const topRatedMovies     = topRated.status     === 'fulfilled' ? topRated.value.results     : [];
  const actionMovieList    = actionMovies.status === 'fulfilled' ? actionMovies.value.results : [];
  const horrorMovieList    = horrorMovies.status === 'fulfilled' ? horrorMovies.value.results : [];
  const scifiMovieList     = scifiMovies.status  === 'fulfilled' ? scifiMovies.value.results  : [];

  return (
    <>
      <HeroSearch featuredMovies={trendingMovies.slice(0, 5)} />

      {/* Header ad */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <AdSlot slotId={process.env.NEXT_PUBLIC_AD_SLOT_HEADER} format="horizontal" minHeight={90} className="w-full" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-14">

        {/* Semantic search callout */}
        <section className="card p-6 md:p-8 relative overflow-hidden noise-overlay">
          <div className="absolute inset-0 bg-gradient-radial from-brand-500/8 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10">
            <p className="section-label mb-1">Smart Search</p>
            <h2 className="text-xl md:text-2xl font-display font-bold text-white mb-2">
              Describe what you want to watch
            </h2>
            <p className="text-slate-400 text-sm mb-5">
              Try natural language — genre, mood, era, language, location. Our search understands it all.
            </p>
            <SemanticSearchBar size="large" />
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                'horror set in Japan',
                'funny sci-fi 90s',
                'best Korean thrillers',
                'Bollywood romance 2023',
                'underrated crime films',
              ].map(q => (
                <Link key={q} href={`/search?q=${encodeURIComponent(q)}&semantic=1`}
                  className="text-xs bg-surface-700 hover:bg-surface-600 border border-white/[0.08] px-3 py-1.5 rounded-full text-slate-400 hover:text-white transition-colors">
                  {q}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Free streaming */}
        {freeStreamMovies.length > 0 && (
          <MovieRow label="100% Free & Legal" title="Free to Stream Right Now" movies={freeStreamMovies} viewAllHref="/free" priority />
        )}

        {/* Trending */}
        {trendingMovies.length > 0 && (
          <MovieRow label="Trending This Week" title="Most Popular Right Now" movies={trendingMovies} viewAllHref="/discover?sort=trending" />
        )}

        <AdSlot slotId={process.env.NEXT_PUBLIC_AD_SLOT_HEADER} format="horizontal" minHeight={90} className="w-full" />

        {/* Top rated */}
        {topRatedMovies.length > 0 && (
          <MovieRow label="All Time Greats" title="Top Rated of All Time" movies={topRatedMovies} viewAllHref="/discover?sort=top_rated" />
        )}

        {/* Action */}
        {actionMovieList.length > 0 && (
          <MovieRow label="Adrenaline Rush" title="Action & Blockbusters" movies={actionMovieList} viewAllHref="/discover?genre=28" />
        )}

        {/* Horror */}
        {horrorMovieList.length > 0 && (
          <MovieRow label="Scare Yourself" title="Horror Movies" movies={horrorMovieList} viewAllHref="/discover?genre=27" />
        )}

        {/* Sci-Fi */}
        {scifiMovieList.length > 0 && (
          <MovieRow label="Niche Genre Picks" title="Science Fiction" movies={scifiMovieList} viewAllHref="/discover?genre=878" />
        )}

        {/* Critic / Creator CTA */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-6 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
            <span className="text-3xl mb-3 block">✍️</span>
            <h3 className="font-display font-bold text-white text-lg mb-2">Are you a Film Critic?</h3>
            <p className="text-slate-400 text-sm mb-4">
              Build your audience, earn commissions, and get a Verified Critic badge on StreamFinder.
            </p>
            <Link href="/register?role=CRITIC" className="btn-ghost text-sm inline-flex">
              Apply as Critic →
            </Link>
          </div>
          <div className="card p-6 border-brand-500/20 bg-gradient-to-br from-brand-500/5 to-transparent">
            <span className="text-3xl mb-3 block">🎬</span>
            <h3 className="font-display font-bold text-white text-lg mb-2">Filmmaker or Actor?</h3>
            <p className="text-slate-400 text-sm mb-4">
              Create a Creator profile. Show your reel, list your credits, and get discovered by studios.
            </p>
            <Link href="/register?role=CREATOR" className="btn-outline text-sm inline-flex">
              Create Creator Profile →
            </Link>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="card p-8 md:p-12 text-center noise-overlay relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-radial from-brand-500/10 via-transparent to-transparent opacity-60 pointer-events-none" />
          <div className="relative z-10">
            <p className="section-label mb-2">Never Pirate Again</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              Every Movie. Every Platform.
            </h2>
            <p className="text-slate-400 max-w-lg mx-auto mb-6">
              StreamFinder checks all major streaming services so you always know the cheapest, fastest legal way to watch any movie.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/free"     className="btn-primary">Browse Free Movies</Link>
              <Link href="/discover" className="btn-ghost">Discover All</Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
