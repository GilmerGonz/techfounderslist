export const locales = ['en', 'es', 'zh', 'de', 'ar', 'it'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'es';
