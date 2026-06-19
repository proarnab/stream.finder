// app/profile/page.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Profile',
  robots: { index: false },
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { welcome?: string; subscribed?: string };
}) {
  const session = await getSession();
  if (!session?.user) redirect('/login?callbackUrl=/profile');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      profile: true,
      subscription: true,
      affiliateCode: true,
      reviews: { orderBy: { createdAt: 'desc' }, take: 5 },
      watchlist: { orderBy: { addedAt: 'desc' }, take: 6 },
    },
  });

  if (!user) redirect('/login');

  const isWelcome    = searchParams.welcome === '1';
  const isSubscribed = searchParams.subscribed === 'true';
  const role         = user.role;
  const sub          = user.subscription;
  const affiliateCode = user.affiliateCode;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://streamfinder.app';
  const affiliateUrl = affiliateCode ? `${siteUrl}/register?ref=${affiliateCode.code}` : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
      {/* Welcome banner */}
      {isWelcome && (
        <div className="mb-6 bg-brand-500/10 border border-brand-500/30 rounded-2xl p-4 flex items-center gap-3 animate-fade-up">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="font-medium text-white text-sm">Welcome to StreamFinder!</p>
            <p className="text-slate-400 text-xs mt-0.5">Your account is ready. Explore features below.</p>
          </div>
        </div>
      )}

      {isSubscribed && (
        <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3 animate-fade-up">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-medium text-white text-sm">Subscription activated!</p>
            <p className="text-slate-400 text-xs mt-0.5">Your Pro features are now live.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Profile card ──────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-5">
          <div className="card p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-700 flex-shrink-0 ring-2 ring-brand-500/30">
                {user.image ? (
                  <Image src={user.image} alt={user.name ?? ''} width={64} height={64} className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-brand-400">
                    {(user.name ?? 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-lg font-display font-bold text-white">{user.name}</h1>
                <p className="text-xs text-slate-500">{user.email}</p>
                <RoleBadge role={role} />
              </div>
            </div>

            {/* Sub status */}
            {sub ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-3">
                <p className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  {sub.plan.replace('_', ' ')} Active
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <Link href="/pricing" className="btn-outline w-full justify-center text-sm py-2.5 mb-3 block text-center">
                Upgrade to Pro
              </Link>
            )}

            <Link href="/profile/edit" className="btn-ghost w-full justify-center text-sm py-2.5 block text-center">
              Edit Profile
            </Link>
          </div>

          {/* Affiliate dashboard — Critics */}
          {affiliateCode && (
            <div className="card p-5">
              <h2 className="font-display font-semibold text-white text-base mb-4 flex items-center gap-2">
                <span>🔗</span> Your Affiliate Link
              </h2>
              <div className="bg-surface-900 rounded-xl p-3 mb-3">
                <p className="text-xs text-slate-500 mb-1">Share this link</p>
                <p className="text-xs font-mono text-brand-400 break-all">{affiliateUrl}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-surface-900 rounded-xl p-2.5">
                  <p className="text-lg font-bold text-white">{affiliateCode.clicks}</p>
                  <p className="text-[10px] text-slate-500">Clicks</p>
                </div>
                <div className="bg-surface-900 rounded-xl p-2.5">
                  <p className="text-lg font-bold text-white">{affiliateCode.conversions}</p>
                  <p className="text-[10px] text-slate-500">Signups</p>
                </div>
                <div className="bg-surface-900 rounded-xl p-2.5">
                  <p className="text-lg font-bold text-emerald-400">
                    ${affiliateCode.totalEarned.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-500">Earned</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-600 mt-3">
                You earn 10% commission for every paid signup via your link.
              </p>
            </div>
          )}
        </div>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Watchlist */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-base">My Watchlist</h2>
              <Link href="/profile/watchlist" className="text-xs text-brand-400 hover:text-brand-300">View all</Link>
            </div>
            {user.watchlist.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {user.watchlist.slice(0, 6).map(item => (
                  <Link key={item.id} href={`/movie/${item.tmdbMovieId}`}
                    className="group block">
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-surface-700">
                      {item.posterPath ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w185${item.posterPath}`}
                          alt={item.movieTitle} width={80} height={120}
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs text-center p-1">
                          {item.movieTitle}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                No movies in your watchlist yet.{' '}
                <Link href="/discover" className="text-brand-400">Start browsing</Link>
              </p>
            )}
          </div>

          {/* Recent reviews */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-base">My Reviews</h2>
              <Link href="/profile/reviews" className="text-xs text-brand-400 hover:text-brand-300">View all</Link>
            </div>
            {user.reviews.length > 0 ? (
              <div className="space-y-3">
                {user.reviews.map(review => (
                  <div key={review.id} className="flex items-start gap-3 p-3 bg-surface-900 rounded-xl">
                    <Link href={`/movie/${review.tmdbMovieId}`} className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{review.movieTitle}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{review.content}</p>
                    </Link>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-yellow-400">{review.rating}/10</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        review.status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-400' :
                        review.status === 'PENDING'  ? 'bg-yellow-500/15 text-yellow-400' :
                        'bg-red-500/15 text-red-400'
                      }`}>
                        {review.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                No reviews yet. Watch a movie and share your thoughts!
              </p>
            )}
          </div>

          {/* Creator profile section */}
          {(role === 'CREATOR' || role === 'CRITIC') && user.profile && (
            <div className="card p-5 border-brand-500/20">
              <h2 className="font-display font-semibold text-white text-base mb-4 flex items-center gap-2">
                {role === 'CRITIC' ? '✍️ Critic Profile' : '🎬 Creator Profile'}
              </h2>
              {user.profile.bio ? (
                <p className="text-sm text-slate-300 mb-4">{user.profile.bio}</p>
              ) : (
                <p className="text-sm text-slate-500 mb-4">Add a bio to attract followers and collaborators.</p>
              )}
              {role === 'CREATOR' && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className={`p-3 rounded-xl ${user.profile.availableForWork ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-surface-900'}`}>
                    <p className="text-xs text-slate-500">Available for Work</p>
                    <p className={`font-medium mt-1 ${user.profile.availableForWork ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {user.profile.availableForWork ? '✓ Visible on profile' : 'Not shown'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-900">
                    <p className="text-xs text-slate-500">Agent Contact</p>
                    <p className="font-medium text-slate-400 mt-1 text-xs truncate">
                      {user.profile.agentEmail ?? 'Not set'}
                    </p>
                  </div>
                </div>
              )}
              <Link href="/profile/edit" className="btn-outline mt-4 inline-flex text-sm">
                Update Profile →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; class: string }> = {
    USER:      { label: 'Member',    class: 'bg-slate-700 text-slate-300' },
    CRITIC:    { label: '✍️ Critic', class: 'bg-purple-500/20 text-purple-400' },
    CREATOR:   { label: '🎬 Creator',class: 'bg-brand-500/20 text-brand-400' },
    MODERATOR: { label: '🛡️ Mod',   class: 'bg-blue-500/20 text-blue-400' },
    ADMIN:     { label: '⚡ Admin',  class: 'bg-red-500/20 text-red-400' },
  };
  const { label, class: cls } = map[role] ?? map.USER;
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${cls}`}>
      {label}
    </span>
  );
}
