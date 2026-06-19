// components/movie/HeroSearch.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { tmdbImage, formatRating } from '@/lib/tmdb';
import type { TMDbMovie } from '@/lib/tmdb';

interface HeroSearchProps {
  featuredMovies?: TMDbMovie[];
}

export function HeroSearch({ featuredMovies = [] }: HeroSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDbMovie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [heroIndex, setHeroIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Cycle hero background
  useEffect(() => {
    if (!featuredMovies.length) return;
    const interval = setInterval(() => {
      setHeroIndex(i => (i + 1) % Math.min(featuredMovies.length, 5));
    }, 6000);
    return () => clearInterval(interval);
  }, [featuredMovies]);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); setShowDropdown(false); return; }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results?.slice(0, 6) ?? []);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        router.push(`/movie/${results[activeIndex].id}`);
        setShowDropdown(false); setQuery('');
      } else if (query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        setShowDropdown(false);
      }
    }
    if (e.key === 'Escape') { setShowDropdown(false); setActiveIndex(-1); }
  };

  const heroMovie = featuredMovies[heroIndex];
  const backdropUrl = heroMovie ? tmdbImage.backdrop(heroMovie.backdrop_path, 'w1280') : null;

  return (
    <section className="relative min-h-[520px] md:min-h-[600px] flex items-center overflow-hidden">
      {/* Background backdrop */}
      <div className="absolute inset-0 overflow-hidden">
        {backdropUrl && (
          <Image
            src={backdropUrl}
            alt=""
            fill
            className="object-cover scale-105 transition-opacity duration-1000"
            priority
            quality={80}
            aria-hidden
          />
        )}
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 bg-surface-950/60" />
        {/* Film grain */}
        <div className="absolute inset-0 opacity-[0.03] bg-noise pointer-events-none" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <div className="text-center mb-10 animate-fade-up">
          <p className="section-label mb-3">Powered by TMDb &amp; JustWatch</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold text-white leading-tight mb-4">
            Find Where to Watch<br />
            <span className="text-brand-400">Any Movie</span> Online
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Discover free streaming, rentals &amp; purchases across every major platform — legally.
          </p>
        </div>

        {/* Search box */}
        <div className="relative max-w-2xl mx-auto animate-fade-up stagger-2">
          <div className="relative">
            {isLoading ? (
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIndex(-1); }}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              onFocus={() => results.length && setShowDropdown(true)}
              placeholder="Search for a movie title…"
              className="w-full bg-surface-900/90 backdrop-blur-md border border-white/10 rounded-2xl
                         pl-12 pr-16 py-4 text-white text-lg placeholder-slate-500 outline-none
                         focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20
                         shadow-2xl shadow-black/40 transition-all duration-200"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
            />
            <button
              onClick={() => query.trim() && router.push(`/search?q=${encodeURIComponent(query.trim())}`)}
              className="absolute right-3 top-1/2 -translate-y-1/2 btn-primary text-sm px-4 py-2"
            >
              Search
            </button>
          </div>

          {/* Autocomplete dropdown */}
          {showDropdown && results.length > 0 && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-surface-900 border border-white/10
                            rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-50 animate-scale-in">
              {results.map((movie, i) => (
                <Link
                  key={movie.id}
                  href={`/movie/${movie.id}`}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-700 transition-colors ${
                    i === activeIndex ? 'bg-surface-700' : ''
                  }`}
                  onClick={() => { setShowDropdown(false); setQuery(''); }}
                >
                  <div className="w-8 h-12 rounded-md overflow-hidden flex-shrink-0 bg-surface-700">
                    {movie.poster_path ? (
                      <Image
                        src={tmdbImage.poster(movie.poster_path, 'w185')!}
                        alt=""
                        width={32} height={48}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{movie.title}</p>
                    <p className="text-xs text-slate-500">
                      {movie.release_date ? new Date(movie.release_date).getFullYear() : ''}
                      {movie.vote_average > 0 && (
                        <span className="ml-2 text-yellow-400">★ {formatRating(movie.vote_average)}</span>
                      )}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
              <Link
                href={`/search?q=${encodeURIComponent(query)}`}
                className="flex items-center justify-center gap-2 px-4 py-3 text-sm text-brand-400
                           hover:bg-surface-800 border-t border-white/[0.06] transition-colors"
                onClick={() => setShowDropdown(false)}
              >
                See all results for &quot;{query}&quot;
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </div>

        {/* Quick genre pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-6 animate-fade-up stagger-3">
          {[
            { label: 'Free Streaming', href: '/free', highlight: true },
            { label: 'Action', href: '/discover?genre=28' },
            { label: 'Comedy', href: '/discover?genre=35' },
            { label: 'Horror', href: '/discover?genre=27' },
            { label: 'Sci-Fi', href: '/discover?genre=878' },
            { label: 'Documentary', href: '/discover?genre=99' },
          ].map(({ label, href, highlight }) => (
            <Link
              key={label}
              href={href}
              className={`genre-pill ${highlight ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:border-emerald-400/60' : ''}`}
            >
              {highlight && '▶ '}
              {label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
