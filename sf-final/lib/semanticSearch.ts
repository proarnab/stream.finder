// lib/semanticSearch.ts
// Parses natural language queries into structured TMDb discover params
// Examples:
//   "horror movie set in London 2024"       → { genres: [27], keywords: ['london'], year: 2024 }
//   "funny romance with happy ending"        → { genres: [35, 10749], mood: 'feel-good' }
//   "thriller directed by a woman"           → { genres: [53], query: 'thriller' }
//   "best sci-fi from the 90s"               → { genres: [878], yearFrom: 1990, yearTo: 1999 }

export interface ParsedQuery {
  // For /search/movie
  textQuery?: string;
  // For /discover/movie
  genreIds: number[];
  keywords: string[];
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  sortBy?: string;
  withCast?: string;
  language?: string;
  isDiscover: boolean;
}

// ─── Genre mappings ────────────────────────────────────────────────────────────
const GENRE_MAP: Record<string, number> = {
  // Horror
  horror: 27, scary: 27, terrifying: 27, slasher: 27, 'ghost film': 27,
  // Comedy
  comedy: 35, funny: 35, hilarious: 35, humor: 35, humour: 35, laugh: 35, comic: 35,
  // Action
  action: 28, fight: 28, explosive: 28, 'action-packed': 28, superhero: 28,
  // Drama
  drama: 18, dramatic: 18, emotional: 18, tearjerker: 18, 'tear-jerker': 18,
  // Science Fiction
  scifi: 878, 'sci-fi': 878, 'science fiction': 878, futuristic: 878, space: 878, alien: 878,
  // Thriller
  thriller: 53, suspense: 53, tension: 53, mystery: 9648,
  // Romance
  romance: 10749, romantic: 10749, love: 10749, 'love story': 10749,
  // Animation
  animation: 16, animated: 16, cartoon: 16, anime: 16,
  // Documentary
  documentary: 99, 'doc film': 99, docuseries: 99,
  // Family
  family: 10751, kids: 10751, children: 10751,
  // Crime
  crime: 80, heist: 80, detective: 80, gangster: 80, mafia: 80,
  // Adventure
  adventure: 12, quest: 12, journey: 12, expedition: 12,
  // Fantasy
  fantasy: 14, magical: 14, fairy: 14, wizards: 14, dragons: 14,
  // History
  historical: 36, history: 36, 'period piece': 36, 'period drama': 36,
  // War
  war: 10752, military: 10752, 'world war': 10752,
};

// ─── Decade / era detection ────────────────────────────────────────────────────
function extractDecade(q: string): { yearFrom?: number; yearTo?: number } {
  const m = q.match(/\b(19|20)(\d0)s\b/i);
  if (m) {
    const yearFrom = parseInt(m[1] + m[2]);
    return { yearFrom, yearTo: yearFrom + 9 };
  }
  const eras: Record<string, [number, number]> = {
    'classic': [1920, 1969],
    'old': [1920, 1980],
    'golden age': [1930, 1960],
    'new wave': [1960, 1980],
    'modern': [2000, new Date().getFullYear()],
    'recent': [new Date().getFullYear() - 3, new Date().getFullYear()],
    'latest': [new Date().getFullYear() - 1, new Date().getFullYear()],
    'new': [new Date().getFullYear() - 1, new Date().getFullYear()],
  };
  for (const [era, [from, to]] of Object.entries(eras)) {
    if (q.toLowerCase().includes(era)) return { yearFrom: from, yearTo: to };
  }
  return {};
}

// ─── Exact year detection ──────────────────────────────────────────────────────
function extractYear(q: string): number | undefined {
  const m = q.match(/\b(19[3-9]\d|20[0-2]\d)\b/);
  return m ? parseInt(m[1]) : undefined;
}

// ─── Rating intent ────────────────────────────────────────────────────────────
function extractMinRating(q: string): number | undefined {
  const lower = q.toLowerCase();
  if (/\b(best|top|great|excellent|award|oscar|masterpiece)\b/.test(lower)) return 7.5;
  if (/\b(good|decent|solid|recommended)\b/.test(lower)) return 6.5;
  if (/\b(cult|underrated|hidden gem)\b/.test(lower)) return 6.0;
  return undefined;
}

// ─── Sort intent ──────────────────────────────────────────────────────────────
function extractSort(q: string): string {
  const lower = q.toLowerCase();
  if (/\b(popular|trending|most watched|blockbuster)\b/.test(lower)) return 'popularity.desc';
  if (/\b(best|top rated|highest rated|critically acclaimed|award)\b/.test(lower)) return 'vote_average.desc';
  if (/\b(new|latest|recent|2024|2025)\b/.test(lower)) return 'release_date.desc';
  return 'popularity.desc';
}

// ─── Language detection ───────────────────────────────────────────────────────
const LANGUAGE_MAP: Record<string, string> = {
  hindi: 'hi', bollywood: 'hi', 'tamil film': 'ta', telugu: 'te',
  korean: 'ko', 'k-drama': 'ko', french: 'fr', spanish: 'es',
  japanese: 'ja', italian: 'it', german: 'de', chinese: 'zh',
  portuguese: 'pt', arabic: 'ar', turkish: 'tr',
};

function extractLanguage(q: string): string | undefined {
  const lower = q.toLowerCase();
  for (const [lang, code] of Object.entries(LANGUAGE_MAP)) {
    if (lower.includes(lang)) return code;
  }
  return undefined;
}

// ─── Location / keyword extraction ────────────────────────────────────────────
const LOCATION_KEYWORDS = [
  'london', 'new york', 'paris', 'tokyo', 'rome', 'berlin', 'mumbai',
  'india', 'japan', 'france', 'italy', 'space', 'underwater', 'forest',
  'school', 'prison', 'submarine', 'desert', 'island', 'apocalypse',
];

function extractLocationKeywords(q: string): string[] {
  const lower = q.toLowerCase();
  return LOCATION_KEYWORDS.filter(kw => lower.includes(kw));
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseSemanticQuery(rawQuery: string): ParsedQuery {
  const q = rawQuery.trim();
  const lower = q.toLowerCase();

  // Detect genres
  const genreIds: number[] = [];
  for (const [keyword, id] of Object.entries(GENRE_MAP)) {
    if (lower.includes(keyword) && !genreIds.includes(id)) {
      genreIds.push(id);
    }
  }

  // Keep max 3 genres for discover API
  const uniqueGenres = [...new Set(genreIds)].slice(0, 3);

  const year      = extractYear(q);
  const decade    = extractDecade(q);
  const minRating = extractMinRating(q);
  const sortBy    = extractSort(q);
  const language  = extractLanguage(q);
  const keywords  = extractLocationKeywords(q);

  // Decide whether to use discover (structured) or search (text)
  // Use discover when we have genre signals; search when it's a title/person name
  const hasStructuredSignals = uniqueGenres.length > 0 || year !== undefined || 
    decade.yearFrom !== undefined || language !== undefined || keywords.length > 0;

  // Clean up the text query for TMDb — remove genre/year/filter words
  const stopWords = [
    'movie', 'film', 'movies', 'films', 'watch', 'show', 'set in', 'from the', 'the best',
    'good', 'great', 'best', 'top', 'latest', 'recent', 'new', 'old', 'classic',
    ...Object.keys(GENRE_MAP),
    ...LOCATION_KEYWORDS,
    ...Object.keys(LANGUAGE_MAP),
  ];
  let cleanedQuery = lower;
  stopWords.forEach(sw => { cleanedQuery = cleanedQuery.replace(new RegExp(`\\b${sw}\\b`, 'gi'), ''); });
  cleanedQuery = cleanedQuery.replace(/\s+/g, ' ').trim();

  return {
    textQuery: cleanedQuery.length > 2 ? cleanedQuery : q,
    genreIds: uniqueGenres,
    keywords,
    year,
    yearFrom: decade.yearFrom,
    yearTo: decade.yearTo,
    minRating,
    sortBy,
    language,
    isDiscover: hasStructuredSignals,
  };
}

// ─── TMDb API caller for semantic results ─────────────────────────────────────

export async function semanticSearch(rawQuery: string): Promise<{
  results: unknown[];
  parsed: ParsedQuery;
  total: number;
}> {
  const parsed = parseSemanticQuery(rawQuery);
  const apiKey = process.env.TMDB_API_KEY!;

  let url: URL;

  if (parsed.isDiscover) {
    url = new URL('https://api.themoviedb.org/3/discover/movie');
    url.searchParams.set('api_key', apiKey);
    if (parsed.genreIds.length > 0) {
      url.searchParams.set('with_genres', parsed.genreIds.join(','));
    }
    if (parsed.year) {
      url.searchParams.set('primary_release_year', String(parsed.year));
    } else {
      if (parsed.yearFrom) url.searchParams.set('primary_release_date.gte', `${parsed.yearFrom}-01-01`);
      if (parsed.yearTo)   url.searchParams.set('primary_release_date.lte', `${parsed.yearTo}-12-31`);
    }
    if (parsed.minRating) {
      url.searchParams.set('vote_average.gte', String(parsed.minRating));
      url.searchParams.set('vote_count.gte', '100');
    }
    if (parsed.language)  url.searchParams.set('with_original_language', parsed.language);
    if (parsed.sortBy)    url.searchParams.set('sort_by', parsed.sortBy);

    // Also add keyword search if we have location/subject keywords
    if (parsed.keywords.length > 0 && parsed.textQuery && parsed.textQuery.length > 1) {
      url.searchParams.set('with_keywords', parsed.keywords.join(','));
    }
  } else {
    // Fallback: text search
    url = new URL('https://api.themoviedb.org/3/search/movie');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('query', parsed.textQuery ?? rawQuery);
    url.searchParams.set('include_adult', 'false');
  }

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  const data = await res.json() as { results: unknown[]; total_results: number };

  return {
    results: data.results ?? [],
    parsed,
    total: data.total_results ?? 0,
  };
}
