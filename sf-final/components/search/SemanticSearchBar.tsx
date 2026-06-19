'use client';
// components/search/SemanticSearchBar.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { tmdbImage, formatRating } from '@/lib/tmdb';
import type { TMDbMovie } from '@/lib/tmdb';

const EXAMPLE_QUERIES = [
  'horror movie set in London',
  'funny sci-fi from the 90s',
  'best Korean thrillers',
  'underrated Bollywood drama',
  'family adventure with magic',
  'top rated crime films 2020s',
  'romantic comedy happy ending',
  'action movie underwater',
];

interface SemanticSearchBarProps {
  size?: 'default' | 'large';
  placeholder?: string;
  autoFocus?: boolean;
}

export function SemanticSearchBar({
  size = 'default',
  placeholder,
  autoFocus = false,
}: SemanticSearchBarProps) {
  const router = useRouter();
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<TMDbMovie[]>([]);
  const [parsedInfo, setParsedInfo] = useState<string>('');
  const [isLoading, setIsLoading]   = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex]   = useState(-1);
  const [exampleIdx, setExampleIdx]     = useState(0);
  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Rotate placeholder examples
  useEffect(() => {
    const t = setInterval(() => setExampleIdx(i => (i + 1) % EXAMPLE_QUERIES.length), 3000);
    return () => clearInterval(t);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); setShowDropdown(false); return; }

    setIsLoading(true);
    try {
      const res  = await fetch(`/api/search/semantic?q=${encodeURIComponent(q)}`);
      const data = await res.json() as {
        results: TMDbMovie[];
        parsed: { genreIds: number[]; year?: number; yearFrom?: number; language?: string; isDiscover: boolean };
        total: number;
      };

      setResults(data.results?.slice(0, 7) ?? []);

      // Build human-readable "understood query" hint
      if (data.parsed) {
        const hints: string[] = [];
        if (data.parsed.genreIds?.length) hints.push(`Genre detected`);
        if (data.parsed.year)             hints.push(`Year: ${data.parsed.year}`);
        if (data.parsed.yearFrom)         hints.push(`Era: ${data.parsed.yearFrom}–${data.parsed.yearTo ?? ''}`);
        if (data.parsed.language)         hints.push(`Language filter applied`);
        if (data.parsed.isDiscover)       hints.push('Smart filters active');
        setParsedInfo(hints.join(' · '));
      }
      setShowDropdown(true);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

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
        router.push(`/search?q=${encodeURIComponent(query.trim())}&semantic=1`);
        setShowDropdown(false);
      }
    }
    if (e.key === 'Escape') { setShowDropdown(false); setActiveIndex(-1); }
  };

  const isLarge = size === 'large';
  const displayPlaceholder = placeholder ?? `Try: "${EXAMPLE_QUERIES[exampleIdx]}"`;

  return (
    <div className="relative w-full">
      <div className="relative group">
        {/* Search icon or spinner */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          {isLoading ? (
            <svg className="w-5 h-5 text-brand-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className={`${isLarge ? 'w-5 h-5' : 'w-4 h-4'} text-slate-500 group-focus-within:text-brand-400 transition-colors`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>

        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setActiveIndex(-1); }}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => { setShowDropdown(false); }, 200)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={displayPlaceholder}
          autoFocus={autoFocus}
          className={`w-full bg-surface-800/90 backdrop-blur-md border border-white/10 rounded-2xl
            ${isLarge ? 'pl-12 pr-20 py-4 text-lg' : 'pl-10 pr-16 py-3 text-sm'}
            text-white placeholder-slate-500 outline-none
            focus:border-brand-500/50 focus:bg-surface-800 focus:ring-2 focus:ring-brand-500/15
            shadow-xl shadow-black/30 transition-all duration-200`}
          aria-label="Search movies with natural language"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />

        {/* Search button */}
        <button
          onClick={() => query.trim() && router.push(`/search?q=${encodeURIComponent(query.trim())}&semantic=1`)}
          className={`absolute right-3 top-1/2 -translate-y-1/2 btn-primary
            ${isLarge ? 'py-2 px-4 text-sm' : 'py-1.5 px-3 text-xs'}`}
        >
          Search
        </button>
      </div>

      {/* Smart filter hint */}
      {parsedInfo && query.length > 3 && (
        <p className="text-[10px] text-brand-400/70 font-mono mt-1.5 ml-1 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
          {parsedInfo}
        </p>
      )}

      {/* Results dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-surface-900 border border-white/[0.08]
                        rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-50 animate-scale-in">
          {results.map((movie, i) => (
            <button
              key={movie.id}
              onMouseDown={() => router.push(`/movie/${movie.id}`)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left
                          hover:bg-surface-700 transition-colors
                          ${i === activeIndex ? 'bg-surface-700' : ''}
                          ${i !== 0 ? 'border-t border-white/[0.04]' : ''}`}
            >
              <div className="w-8 h-12 rounded-md overflow-hidden flex-shrink-0 bg-surface-700">
                {movie.poster_path ? (
                  <Image
                    src={tmdbImage.poster(movie.poster_path, 'w92')!}
                    alt="" width={32} height={48}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-600 flex items-center justify-center">
                    <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{movie.title}</p>
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  {movie.release_date && <span>{new Date(movie.release_date).getFullYear()}</span>}
                  {movie.vote_average > 0 && (
                    <span className="text-yellow-400">★ {formatRating(movie.vote_average)}</span>
                  )}
                </p>
              </div>
              <svg className="w-4 h-4 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}

          {/* Full results link */}
          <button
            onMouseDown={() => router.push(`/search?q=${encodeURIComponent(query)}&semantic=1`)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-brand-400
                       hover:bg-surface-800 border-t border-white/[0.06] transition-colors"
          >
            See all results for &ldquo;{query}&rdquo;
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* No results */}
      {showDropdown && !isLoading && query.length > 3 && results.length === 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-surface-900 border border-white/[0.08]
                        rounded-2xl p-4 text-center z-50">
          <p className="text-sm text-slate-400">No movies found for &ldquo;{query}&rdquo;</p>
          <p className="text-xs text-slate-600 mt-1">Try different keywords</p>
        </div>
      )}
    </div>
  );
}
