'use client';
// components/movie/ReviewSection.tsx
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';

interface Review {
  id: string;
  rating: number;
  content: string;
  containsSpoilers: boolean;
  helpfulVotes: number;
  createdAt: string;
  user: {
    name: string | null;
    image: string | null;
    role: string;
    profile?: { criticBadge: string | null } | null;
  };
}

interface ReviewSectionProps {
  movieId: number;
  movieTitle: string;
}

export function ReviewSection({ movieId, movieTitle }: ReviewSectionProps) {
  const { data: session } = useSession();
  const [reviews, setReviews]         = useState<Review[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [rating, setRating]           = useState(7);
  const [content, setContent]         = useState('');
  const [spoilers, setSpoilers]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [submitMsg, setSubmitMsg]     = useState('');
  const [spoilerRevealed, setSpoilerRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/reviews?movieId=${movieId}`)
      .then(r => r.json())
      .then((d: { reviews: Review[] }) => setReviews(d.reviews))
      .finally(() => setLoading(false));
  }, [movieId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim().length < 20) {
      setSubmitMsg('Review must be at least 20 characters');
      return;
    }
    setSubmitting(true);
    setSubmitMsg('');
    try {
      const res  = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbMovieId: movieId, movieTitle, rating, content: content.trim(), containsSpoilers: spoilers }),
      });
      const data = await res.json() as { review?: Review; error?: string; status?: string };
      if (!res.ok) {
        setSubmitMsg(data.error ?? 'Failed to submit');
      } else {
        if (data.status === 'APPROVED' && data.review) {
          setReviews(r => [data.review as Review, ...r]);
        }
        setSubmitMsg(data.status === 'APPROVED'
          ? '✓ Review published!'
          : '✓ Review submitted — pending moderation.');
        setContent(''); setRating(7); setShowForm(false);
      }
    } catch {
      setSubmitMsg('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="section-label mb-1">Community</p>
          <h2 className="section-title">Reviews</h2>
        </div>
        {session?.user ? (
          <button onClick={() => setShowForm(f => !f)} className="btn-outline text-sm">
            {showForm ? 'Cancel' : '+ Write Review'}
          </button>
        ) : (
          <Link href={`/login?callbackUrl=/movie/${movieId}`} className="btn-ghost text-sm">
            Sign in to Review
          </Link>
        )}
      </div>

      {/* Submit form */}
      {showForm && session?.user && (
        <form onSubmit={handleSubmit} className="card p-5 mb-6 animate-fade-in space-y-4">
          <h3 className="font-display font-semibold text-white">Your Review</h3>

          {/* Star rating */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Rating: {rating}/10</label>
            <div className="flex items-center gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <button
                  key={n} type="button"
                  onClick={() => setRating(n)}
                  className={`text-xl transition-transform hover:scale-110 ${n <= rating ? 'text-yellow-400' : 'text-slate-700'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Your thoughts (min 20 characters)</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={4}
              placeholder={`What did you think of ${movieTitle}?`}
              className="w-full bg-surface-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white
                         placeholder-slate-600 outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20
                         resize-none transition-all"
              maxLength={5000}
            />
            <p className="text-[10px] text-slate-600 mt-1">{content.length}/5000</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox" checked={spoilers} onChange={e => setSpoilers(e.target.checked)}
              className="w-4 h-4 rounded bg-surface-700 border-white/20 text-brand-500"
            />
            <span className="text-sm text-slate-400">Contains spoilers</span>
          </label>

          {submitMsg && (
            <p className={`text-sm ${submitMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
              {submitMsg}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </form>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => (
            <div key={i} className="card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="skeleton w-10 h-10 rounded-full" />
                <div className="skeleton h-4 w-32 rounded" />
              </div>
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-4/5 rounded" />
            </div>
          ))}
        </div>
      ) : reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map(review => (
            <div key={review.id} className="card p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-700 flex-shrink-0">
                  {review.user.image ? (
                    <Image src={review.user.image} alt="" width={40} height={40} className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">
                      {(review.user.name ?? 'U')[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white">{review.user.name ?? 'Anonymous'}</p>
                    {review.user.role === 'CRITIC' && (
                      <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full border border-purple-500/20">
                        ✍️ {review.user.profile?.criticBadge ?? 'Critic'}
                      </span>
                    )}
                    {review.containsSpoilers && (
                      <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">
                        ⚠ Spoilers
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-yellow-400 text-xs font-mono">{'★'.repeat(Math.round(review.rating / 2))}{'☆'.repeat(5 - Math.round(review.rating / 2))}</span>
                    <span className="text-xs text-slate-500 font-mono">{review.rating}/10</span>
                    <span className="text-xs text-slate-600">·</span>
                    <span className="text-xs text-slate-600">
                      {new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Content — hide spoilers */}
              {review.containsSpoilers && !spoilerRevealed[review.id] ? (
                <div className="bg-surface-900 rounded-xl p-4 text-center">
                  <p className="text-sm text-slate-500 mb-2">This review contains spoilers</p>
                  <button
                    onClick={() => setSpoilerRevealed(r => ({ ...r, [review.id]: true }))}
                    className="text-xs text-brand-400 underline"
                  >
                    Show anyway
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-300 leading-relaxed">{review.content}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-slate-500">
          <p className="text-sm">No reviews yet. Be the first!</p>
        </div>
      )}
    </section>
  );
}
