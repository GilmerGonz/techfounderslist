import React from 'react';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider, useMessages } from 'next-intl';
import '../globals.css';

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap';

export const metadata: Metadata = {
  title: 'The Tech Founders List — Capital signals conviction.',
  description:
    'A private index of tech companies, ordered by committed capital. Claim a position by outbidding the current holder.',
  metadataBase: new URL('https://techfounderslist.com'),
  alternates: {
    languages: {
      en: '/en',
      es: '/es',
    },
  },
  openGraph: {
    type: 'website',
    title: 'The Tech Founders List',
    description:
      'A private index of tech companies, ordered by committed capital. Claim a position by outbidding the current holder.',
    siteName: 'The Tech Founders List',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Tech Founders List',
    description:
      'A private index of tech companies, ordered by committed capital.',
  },
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#F7F4EE',
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export default function LocaleLayout({ children, params: { locale } }: LocaleLayoutProps) {
  const messages = useMessages();

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_HREF} />
      </head>
      <body className="min-h-screen bg-paper text-ink">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
