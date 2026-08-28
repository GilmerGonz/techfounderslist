import type { MetadataRoute } from 'next';

const SITE_URL = 'https://techfounderslist.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/*/manage'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
