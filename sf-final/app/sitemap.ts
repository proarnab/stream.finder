// app/sitemap.ts
import { MetadataRoute } from 'next';
import { getTrending } from '@/lib/tmdb';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://streamfinder.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/free`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/discover`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/search`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
  ];

  // Top trending movies
  let moviePages: MetadataRoute.Sitemap = [];
  try {
    const { results } = await getTrending('week');
    moviePages = results.slice(0, 40).map(movie => ({
      url: `${SITE_URL}/movie/${movie.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch {
    /* Skip on error */
  }

  return [...staticPages, ...moviePages];
}
