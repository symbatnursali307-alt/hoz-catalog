import type { MetadataRoute } from 'next';
import { MAIN_SITE_URL } from '@/lib/site-content';

export default function robots(): MetadataRoute.Robots {
  const privatePaths = ['/admin', '/api/', '/m/', '/order/', '/offline'];

  return {
    rules: [
      {
        userAgent: ['OAI-SearchBot', 'ChatGPT-User', 'GPTBot'],
        allow: '/',
        disallow: privatePaths,
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: privatePaths,
      },
    ],
    sitemap: `${MAIN_SITE_URL}/sitemap.xml`,
    host: MAIN_SITE_URL,
  };
}
