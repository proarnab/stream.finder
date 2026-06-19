// app/profile/watchlist/page.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Watchlist',
  robots: { index: false },
};

export default async function WatchlistPage() {
  const session = await getSession();
  if (!session?.user) redirect('/login?callbackUrl=/profile/watchlist');

  const items = await prisma.watchlistItem.findMany({
    where: { userId: session.user.id },
    orderBy: { addedAt: 'desc' },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/profile" className="text-slate-500 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <p className="section-label mb-0.5">Your List</p>
          <h1 className="section-title">Watchlist</h1>
        </div>
        <span className="ml-2 text-sm text-slate-500">({items.length} movies)</span>
      </div>

      {items.length > 0 ? (
        <div className="movie-grid">
          {items.map(item => (
            <Link key={item.id} href={`/movie/${item.tmdbMovieId}`} className="group block">
              <div className="poster rounded-lg bg-surface-800 shadow-lg group-hover:-translate-y-1 transition-transform duration-300">
                {item.posterPath ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w342${item.posterPath}`}
                    alt={item.movieTitle} fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 150px, 180px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-surface-700 p-3">
                    <p className="text-xs text-slate-500 text-center">{item.movieTitle}</p>
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs font-medium text-white truncate group-hover:text-brand-400 transition-colors">
                {item.movieTitle}
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                Added {new Date(item.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-surface-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-semibold text-white mb-2">Watchlist is empty</h2>
          <p className="text-slate-400 text-sm mb-6">Save movies to watch later by clicking the Watchlist button on any movie page.</p>
          <Link href="/discover" className="btn-primary">Browse Movies</Link>
        </div>
      )}
    </div>
  );
}
