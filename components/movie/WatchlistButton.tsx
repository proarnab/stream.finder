'use client';
// components/movie/WatchlistButton.tsx
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface WatchlistButtonProps {
  movieId: number;
  movieTitle: string;
  posterPath?: string | null;
  className?: string;
}

export function WatchlistButton({ movieId, movieTitle, posterPath, className = '' }: WatchlistButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [inWatchlist, setInWatchlist] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  // Check status on mount
  useEffect(() => {
    if (!session?.user) return;
    fetch(`/api/watchlist?movieId=${movieId}`)
      .then(r => r.json())
      .then((d: { inWatchlist: boolean }) => {
        setInWatchlist(d.inWatchlist);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [session, movieId]);

  const toggle = async () => {
    if (!session?.user) {
      router.push(`/login?callbackUrl=/movie/${movieId}`);
      return;
    }
    setLoading(true);
    try {
      if (inWatchlist) {
        await fetch(`/api/watchlist?movieId=${movieId}`, { method: 'DELETE' });
        setInWatchlist(false);
      } else {
        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tmdbMovieId: movieId, movieTitle, posterPath }),
        });
        setInWatchlist(true);
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  };

  if (!checked && session?.user) {
    return (
      <button className={`btn-ghost opacity-50 cursor-not-allowed ${className}`} disabled>
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`btn-ghost gap-2 transition-all ${
        inWatchlist ? 'border-brand-500/40 text-brand-400 bg-brand-500/10' : ''
      } ${className}`}
      aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
      title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      <svg
        className={`w-4 h-4 transition-all ${inWatchlist ? 'fill-brand-400 text-brand-400' : 'fill-none'}`}
        stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
      <span className="text-sm">{inWatchlist ? 'Saved' : 'Watchlist'}</span>
    </button>
  );
}
