// app/api/reviews/route.ts — HARDENED
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/ratelimit';
import { stripHtml, clean, parseIntSafe } from '@/lib/sanitize';

const schema = z.object({
  tmdbMovieId:      z.number().int().positive().max(9_999_999),
  movieTitle:       z.string().min(1).max(300),
  rating:           z.number().min(1).max(10),
  content:          z.string().min(20).max(5000),
  containsSpoilers: z.boolean().optional().default(false),
});

export async function GET(req: NextRequest) {
  const movieId = parseIntSafe(req.nextUrl.searchParams.get('movieId'));
  if (movieId === null) return NextResponse.json({ reviews: [] });
  const reviews = await prisma.review.findMany({
    where: { tmdbMovieId: movieId, status: 'APPROVED' },
    include: { user: { select: { name: true, image: true, role: true, profile: { select: { criticBadge: true } } } } },
    orderBy: { helpfulVotes: 'desc' },
    take: 20,
  });
  return NextResponse.json({ reviews }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const userRl = await rateLimitByUser(session.user.id, RATE_LIMITS.REVIEW_SUBMIT);
  if (!userRl.success) return NextResponse.json({ error: 'Review limit reached. Up to 5 reviews per hour.' }, { status: 429 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid review data', details: err.errors }, { status: 400 });
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const sanitizedContent = stripHtml(body.content);
  const sanitizedMovieTitle = clean(stripHtml(body.movieTitle), 300);
  if (sanitizedContent.length < 20) return NextResponse.json({ error: 'Review content too short' }, { status: 400 });

  try {
    const existing = await prisma.review.findFirst({ where: { userId: session.user.id, tmdbMovieId: body.tmdbMovieId }, select: { id: true } });
    if (existing) return NextResponse.json({ error: 'You have already reviewed this movie' }, { status: 409 });
    const isCritic = ['CRITIC','MODERATOR','ADMIN'].includes(session.user.role);
    const review = await prisma.review.create({
      data: { userId: session.user.id, tmdbMovieId: body.tmdbMovieId, movieTitle: sanitizedMovieTitle,
              rating: body.rating, content: sanitizedContent, containsSpoilers: body.containsSpoilers,
              status: isCritic ? 'APPROVED' : 'PENDING' },
    });
    if (isCritic) await prisma.userProfile.update({ where: { userId: session.user.id }, data: { totalReviews: { increment: 1 } } });
    return NextResponse.json({ review, status: review.status }, { status: 201 });
  } catch (err) {
    console.error('Review error:', err);
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}
