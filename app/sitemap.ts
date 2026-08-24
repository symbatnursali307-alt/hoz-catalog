import type { MetadataRoute } from 'next';
import { MAIN_SITE_URL, marketingCategories } from '@/lib/site-content';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: MAIN_SITE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${MAIN_SITE_URL}/categories`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...marketingCategories.map((category) => ({
      url: `${MAIN_SITE_URL}/categories/${category.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    { url: `${MAIN_SITE_URL}/optom`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${MAIN_SITE_URL}/delivery`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${MAIN_SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${MAIN_SITE_URL}/contacts`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${MAIN_SITE_URL}/for-ai`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.6 },
  ];
}
