'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from '@/navigation';
import clsx from 'clsx';
import { Shuffle } from 'lucide-react';
import { locales } from '@/i18n';

const LOCALE_LABELS: Record<string, string> = {
  en: 'EN',
  es: 'ES',
};

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface NavbarProps {
  locale: string;
  categories: Category[];
  activeCategorySlug: string;
  onSelectCategory: (slug: string) => void;
  t: (key: string, values?: any) => string;
  onOpenSubmitModal: () => void;
  onSurpriseMe?: () => void;
}

/**
 * Persistent header — 56px, Paper background, hairline bottom border.
 * Wordmark: IBM Plex Sans 600, "Techfounderslist" — no icon, no dot, no pulse.
 * Category tabs: underline style (publication section navigation).
 * CTA: outline style, not filled.
 */
export function Navbar({
  locale,
  categories,
  activeCategorySlug,
  onSelectCategory,
  t,
  onOpenSubmitModal,
  onSurpriseMe,
}: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 w-full bg-paper transition-colors',
        scrolled ? 'border-b border-ink/20' : 'border-b-hairline'
      )}
      style={{ height: 56 }}
    >
      <div className="mx-auto flex h-full max-w-content items-center justify-between gap-4 px-4 sm:px-8">
        {/* Wordmark — IBM Plex Sans 600, no icon, no dot */}
        <Link href={`/${locale}`} className="shrink-0 select-none" aria-label="Techfounderslist home">
          <span className="font-body text-lg font-semibold tracking-tight text-ink">
            Techfounderslist
          </span>
        </Link>

        {/* Category tabs — underline style, not filled pills */}
        <nav className="hidden md:flex items-center gap-6 overflow-x-auto" aria-label="Indices">
          {categories.map((cat) => {
            const isActive = cat.slug === activeCategorySlug;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.slug)}
                className={clsx(
                  'relative whitespace-nowrap pb-1 text-[13px] font-medium transition-colors',
                  isActive
                    ? 'text-ink border-b-2 border-ink'
                    : 'text-ink-60 hover:text-ink border-b-2 border-transparent'
                )}
              >
                {cat.name}
              </button>
            );
          })}
        </nav>

        {/* Locale switcher + outline CTA */}
        <div className="flex shrink-0 items-center gap-3">
          {onSurpriseMe && (
            <button
              onClick={onSurpriseMe}
              className="hidden items-center gap-1.5 rounded-sm px-2 py-2 text-[13px] font-medium text-ink-60 transition-colors hover:text-ink focus:outline-none md:inline-flex"
            >
              <Shuffle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              {t('common.surpriseMe')}
            </button>
          )}

          <label className="relative">
            <span className="sr-only">{t('common.language')}</span>
            <select
              value={locale}
              onChange={(e) => handleLocaleChange(e.target.value)}
              className="cursor-pointer appearance-none bg-transparent py-1 pe-5 ps-1 text-xs font-medium text-ink-60 hover:text-ink focus:outline-none"
            >
              {locales.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_LABELS[l]}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 10 6"
              className="pointer-events-none absolute end-0 top-1/2 h-1.5 w-2.5 -translate-y-1/2 stroke-current text-ink-30"
              fill="none"
            >
              <path d="M1 1l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </label>

          <button
            onClick={onOpenSubmitModal}
            className="rounded-sm border border-ink/20 px-5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            {t('common.submitProject')}
          </button>
        </div>
      </div>
    </header>
  );
}
