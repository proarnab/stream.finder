// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchMovies } from '@/lib/tmdb';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10);

  if (!q?.trim()) {
    return NextResponse.json({ results: [], total_results: 0, page: 1, total_pages: 0 });
  }

  try {
    const data = await searchMovies(q.trim(), page);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    });
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
