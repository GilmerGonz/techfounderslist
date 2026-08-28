import type { MetadataRoute } from 'next';
import { locales } from '@/i18n';

const SITE_URL = 'https://techfounderslist.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return locales.map((locale) => ({
    url: `${SITE_URL}/${locale}`,
    lastModified: now,
    changeFrequency: 'hourly',
    priority: 1,
  }));
}
