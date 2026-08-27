import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

export const locales = ['en', 'es', 'zh', 'de', 'ar', 'it'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({ locale }) => {
  const targetLocale = locale || defaultLocale;
  if (!locales.includes(targetLocale as any)) notFound();

  return {
    locale: targetLocale,
    messages: (await import(`../messages/${targetLocale}.json`)).default,
  };
});
