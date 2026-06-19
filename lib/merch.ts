// lib/merch.ts
// Generates affiliate links for physical & digital merchandise
// Uses Amazon Product Advertising API search URLs + affiliate tag injection

export interface MerchItem {
  type: 'bluray' | 'dvd' | 'poster' | 'tshirt' | 'book' | 'soundtrack' | 'digital';
  label: string;
  icon: string;
  searchQuery: string;
  commission: string;
}

const AFFILIATE_TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG ?? '';
const APPLE_TOKEN   = process.env.NEXT_PUBLIC_APPLE_AFFILIATE_TOKEN ?? '';

// Build Amazon search URL with affiliate tag
function amazonSearchUrl(query: string): string {
  const url = new URL('https://www.amazon.com/s');
  url.searchParams.set('k', query);
  if (AFFILIATE_TAG) url.searchParams.set('tag', AFFILIATE_TAG);
  return url.toString();
}

// Build Apple iTunes movie URL
function itunesUrl(title: string, year: string): string {
  const base = `https://itunes.apple.com/search?term=${encodeURIComponent(`${title} ${year}`)}&media=movie&limit=1`;
  if (APPLE_TOKEN) return `${base}&at=${APPLE_TOKEN}&ct=streamfinder_merch`;
  return base;
}

// Build eBay search URL
function ebaySearchUrl(query: string): string {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sacat=617`;
}

export function getMerchItems(movieTitle: string, year: string): MerchItem[] {
  return [
    {
      type: 'bluray',
      label: `Buy on Blu-ray`,
      icon: '💿',
      searchQuery: amazonSearchUrl(`${movieTitle} Blu-ray ${year}`),
      commission: '~4% commission',
    },
    {
      type: 'dvd',
      label: `Buy DVD`,
      icon: '📀',
      searchQuery: amazonSearchUrl(`${movieTitle} DVD ${year}`),
      commission: '~4% commission',
    },
    {
      type: 'poster',
      label: `Official Poster`,
      icon: '🖼️',
      searchQuery: amazonSearchUrl(`${movieTitle} movie poster print`),
      commission: '~4-10% commission',
    },
    {
      type: 'tshirt',
      label: `Movie T-Shirt`,
      icon: '👕',
      searchQuery: amazonSearchUrl(`${movieTitle} movie t-shirt merchandise`),
      commission: '~4% commission',
    },
    {
      type: 'book',
      label: `Screenplay / Book`,
      icon: '📖',
      searchQuery: amazonSearchUrl(`${movieTitle} screenplay book film`),
      commission: '~4% commission',
    },
    {
      type: 'soundtrack',
      label: `Soundtrack`,
      icon: '🎵',
      searchQuery: amazonSearchUrl(`${movieTitle} original motion picture soundtrack`),
      commission: '~4% commission',
    },
  ];
}

// ─── Digital purchase links (already handled in WatchProviders, but
//     merch widget shows direct iTunes / Amazon Video links separately)
export function getDigitalPurchaseLinks(movieTitle: string, year: string) {
  const amzUrl = new URL('https://www.amazon.com/s');
  amzUrl.searchParams.set('k', `${movieTitle} ${year} prime video`);
  amzUrl.searchParams.set('i', 'instant-video');
  if (AFFILIATE_TAG) amzUrl.searchParams.set('tag', AFFILIATE_TAG);

  return {
    amazonVideo: amzUrl.toString(),
    appleItunes: itunesUrl(movieTitle, year),
  };
}
