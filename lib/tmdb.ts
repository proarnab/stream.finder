// lib/tmdb.ts
// Official TMDb API v3 client — all data sourced legally via TMDb's free API
// Documentation: https://developer.themoviedb.org/docs

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// ─── Image URL helpers ──────────────────────────────────────────────────────

export const tmdbImage = {
  poster: (path: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500') =>
    path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null,
  backdrop: (path: string | null, size: 'w300' | 'w780' | 'w1280' | 'original' = 'w1280') =>
    path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null,
  profile: (path: string | null, size: 'w45' | 'w185' | 'h632' | 'original' = 'w185') =>
    path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null,
  logo: (path: string | null, size: 'w45' | 'w92' | 'w154' | 'w185' | 'w300' | 'w500' | 'original' = 'w92') =>
    path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null,
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TMDbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  runtime?: number;
  tagline?: string;
  status?: string;
  budget?: number;
  revenue?: number;
  imdb_id?: string;
  homepage?: string;
  spoken_languages?: { english_name: string; iso_639_1: string }[];
  production_countries?: { iso_3166_1: string; name: string }[];
}

export interface TMDbCredits {
  cast: {
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
    order: number;
    known_for_department: string;
  }[];
  crew: {
    id: number;
    name: string;
    job: string;
    department: string;
    profile_path: string | null;
  }[];
}

export interface TMDbWatchProvider {
  logo_path: string;
  provider_id: number;
  provider_name: string;
  display_priority: number;
}

export interface TMDbWatchProviders {
  id: number;
  results: {
    [countryCode: string]: {
      link: string;
      flatrate?: TMDbWatchProvider[];   // Subscription (Netflix, Hulu)
      free?: TMDbWatchProvider[];        // Free with ads (Tubi, Pluto, Freevee)
      ads?: TMDbWatchProvider[];         // Ad-supported (similar to free)
      rent?: TMDbWatchProvider[];        // Rental (Amazon, Apple TV)
      buy?: TMDbWatchProvider[];         // Purchase
    };
  };
}

export interface TMDbSearchResult {
  page: number;
  results: TMDbMovie[];
  total_pages: number;
  total_results: number;
}

export interface TMDbMovieDetails extends TMDbMovie {
  credits: TMDbCredits;
  similar: TMDbSearchResult;
  videos: {
    results: {
      id: string;
      key: string;
      name: string;
      site: string;
      type: string;
      official: boolean;
    }[];
  };
}

// ─── Fetch helper ────────────────────────────────────────────────────────────

async function tmdbFetch<T>(
  endpoint: string,
  params: Record<string, string> = {},
  revalidate = 3600
): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error('TMDB_API_KEY is not set. Add it to .env.local');
  }

  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    next: { revalidate },
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`TMDb API error: ${res.status} ${res.statusText} — ${endpoint}`);
  }

  return res.json() as Promise<T>;
}

// ─── API Methods ─────────────────────────────────────────────────────────────

/** Trending movies this week */
export async function getTrending(timeWindow: 'day' | 'week' = 'week'): Promise<TMDbSearchResult> {
  return tmdbFetch<TMDbSearchResult>(`/trending/movie/${timeWindow}`, {}, 3600);
}

/** Full movie details including credits, similar, videos */
export async function getMovieDetails(movieId: number): Promise<TMDbMovieDetails> {
  return tmdbFetch<TMDbMovieDetails>(
    `/movie/${movieId}`,
    { append_to_response: 'credits,similar,videos' },
    86400 // Cache for 24h — details rarely change
  );
}

/** Where to watch — powered by JustWatch via TMDb */
export async function getWatchProviders(
  movieId: number,
  countryCode = 'US'
): Promise<TMDbWatchProviders['results'][string] | null> {
  const data = await tmdbFetch<TMDbWatchProviders>(
    `/movie/${movieId}/watch/providers`,
    {},
    3600
  );
  return data.results[countryCode] ?? null;
}

/** Search movies by query */
export async function searchMovies(
  query: string,
  page = 1
): Promise<TMDbSearchResult> {
  return tmdbFetch<TMDbSearchResult>('/search/movie', {
    query,
    page: String(page),
    include_adult: 'false',
  }, 300);
}

/** Discover movies by genre */
export async function discoverByGenre(
  genreId: number,
  page = 1,
  sortBy = 'popularity.desc'
): Promise<TMDbSearchResult> {
  return tmdbFetch<TMDbSearchResult>('/discover/movie', {
    with_genres: String(genreId),
    page: String(page),
    sort_by: sortBy,
    'vote_count.gte': '100',
  }, 3600);
}

/** Movies available for free streaming (discovers by monetization type via JustWatch) */
export async function getFreeStreamingMovies(
  countryCode = 'US',
  page = 1
): Promise<TMDbSearchResult> {
  return tmdbFetch<TMDbSearchResult>('/discover/movie', {
    watch_region: countryCode,
    with_watch_monetization_types: 'free|ads',
    sort_by: 'popularity.desc',
    'vote_count.gte': '50',
    page: String(page),
  }, 3600);
}

/** Top rated movies */
export async function getTopRated(page = 1): Promise<TMDbSearchResult> {
  return tmdbFetch<TMDbSearchResult>('/movie/top_rated', { page: String(page) }, 3600);
}

/** Now playing in theaters */
export async function getNowPlaying(
  countryCode = 'US',
  page = 1
): Promise<TMDbSearchResult> {
  return tmdbFetch<TMDbSearchResult>('/movie/now_playing', {
    region: countryCode,
    page: String(page),
  }, 3600);
}

/** All available genre list */
export async function getGenres(): Promise<{ genres: { id: number; name: string }[] }> {
  return tmdbFetch('/genre/movie/list', {}, 86400 * 7);
}

// ─── Genre constants (stable IDs) ────────────────────────────────────────────

export const GENRES = {
  ACTION: 28,
  COMEDY: 35,
  DRAMA: 18,
  HORROR: 27,
  SCIFI: 878,
  THRILLER: 53,
  DOCUMENTARY: 99,
  ANIMATION: 16,
  ROMANCE: 10749,
  CRIME: 80,
  FAMILY: 10751,
  ADVENTURE: 12,
} as const;

// ─── Affiliate link builders ──────────────────────────────────────────────────

export function buildAmazonLink(baseUrl: string): string {
  const tag = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG;
  if (!tag || !baseUrl.includes('amazon.com')) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set('tag', tag);
  return url.toString();
}

export function buildAppleLink(baseUrl: string): string {
  const token = process.env.NEXT_PUBLIC_APPLE_AFFILIATE_TOKEN;
  if (!token || !baseUrl.includes('apple.com')) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set('at', token);
  url.searchParams.set('ct', 'streamfinder');
  return url.toString();
}

/** Injects affiliate tracking into provider links where applicable */
export function injectAffiliateLink(baseUrl: string, providerName: string): string {
  if (providerName.toLowerCase().includes('amazon')) return buildAmazonLink(baseUrl);
  if (providerName.toLowerCase().includes('apple')) return buildAppleLink(baseUrl);
  return baseUrl;
}

// ─── Provider classification helpers ─────────────────────────────────────────

/** These provider IDs are known to be free/ad-supported (keep updated) */
export const FREE_PROVIDER_IDS = new Set([
  73,   // Tubi TV
  300,  // Pluto TV
  613,  // Freevee (Amazon)
  386,  // Peacock (free tier)
  531,  // Paramount+ (free trial / Pluto)
  546,  // Crackle
  674,  // Plex
  1853, // Kanopy
  269,  // Fawesome
  884,  // Popcornflix
]);

export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatRating(rating: number): string {
  return (Math.round(rating * 10) / 10).toFixed(1);
}

export function getRatingColor(rating: number): string {
  if (rating >= 7.5) return 'text-emerald-400';
  if (rating >= 6.0) return 'text-yellow-400';
  if (rating >= 5.0) return 'text-orange-400';
  return 'text-red-400';
}

export function getYear(dateStr: string): string {
  return dateStr ? new Date(dateStr).getFullYear().toString() : 'N/A';
}
