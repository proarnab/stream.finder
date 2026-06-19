// app/api/watchlist/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  tmdbMovieId: z.number(),
  movieTitle:  z.string(),
  posterPath:  z.string().optional().nullable(),
});

// GET — check if a movie is in watchlist
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ inWatchlist: false });

  const movieId = parseInt(req.nextUrl.searchParams.get('movieId') ?? '', 10);
  if (isNaN(movieId)) return NextResponse.json({ inWatchlist: false });

  const item = await prisma.watchlistItem.findUnique({
    where: { userId_tmdbMovieId: { userId: session.user.id, tmdbMovieId: movieId } },
  });

  return NextResponse.json({ inWatchlist: !!item });
}

// POST — add to watchlist
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const body = schema.parse(await req.json());

  await prisma.watchlistItem.upsert({
    where: { userId_tmdbMovieId: { userId: session.user.id, tmdbMovieId: body.tmdbMovieId } },
    create: { userId: session.user.id, ...body },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

// DELETE — remove from watchlist
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const movieId = parseInt(req.nextUrl.searchParams.get('movieId') ?? '', 10);
  if (isNaN(movieId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  await prisma.watchlistItem.deleteMany({
    where: { userId: session.user.id, tmdbMovieId: movieId },
  });

  return NextResponse.json({ ok: true });
}
