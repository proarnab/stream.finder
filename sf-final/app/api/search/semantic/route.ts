// app/api/search/semantic/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { semanticSearch } from '@/lib/semanticSearch';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  if (!q?.trim()) {
    return NextResponse.json({ results: [], total: 0 });
  }

  try {
    const data = await semanticSearch(q.trim());
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    });
  } catch (err) {
    console.error('Semantic search error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
