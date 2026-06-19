// app/api/providers/[movieId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getWatchProviders } from '@/lib/tmdb';

export const runtime = 'edge';

export async function GET(
  req: NextRequest,
  { params }: { params: { movieId: string } }
) {
  const movieId = parseInt(params.movieId, 10);
  if (isNaN(movieId)) {
    return NextResponse.json({ error: 'Invalid movie ID' }, { status: 400 });
  }

  // Detect country: 1) query param, 2) CF-IPCountry header, 3) env default, 4) US
  const country =
    req.nextUrl.searchParams.get('country') ??
    req.headers.get('CF-IPCountry') ??
    process.env.NEXT_PUBLIC_DEFAULT_COUNTRY ??
    'US';

  try {
    const providers = await getWatchProviders(movieId, country.toUpperCase());
    return NextResponse.json(
      { providers, country: country.toUpperCase() },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' } }
    );
  } catch (err) {
    console.error('Providers error:', err);
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
  }
}
