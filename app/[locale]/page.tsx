'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { HeroBanner } from '@/components/HeroBanner';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { LiveActivityFeed } from '@/components/LiveActivityFeed';
import { GlobalMarketsSection } from '@/components/GlobalMarketsSection';
import { TotalCommitted } from '@/components/TotalCommitted';
import { ClaimPositionModal } from '@/components/ClaimPositionModal';
import { SubmitCompanyModal } from '@/components/SubmitCompanyModal';

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface Ranking {
  position: number;
  currentAmountCents: number;
  heldSince: string | Date;
  company: {
    id: string;
    name: string;
    url: string;
    logoUrl?: string;
    description?: string;
    verified?: boolean;
  };
}

export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations();

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategorySlug, setActiveCategorySlug] = useState<string>('saas');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [rankings, setRankings] = useState<Ranking[]>([]);

  // Modals state
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [targetPosition, setTargetPosition] = useState<number>(1);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // "Surprise me" spotlight — which holder to scroll to & flash
  const [highlightCompanyId, setHighlightCompanyId] = useState<string | null>(null);
  const [highlightSeq, setHighlightSeq] = useState(0);

  // Fetch categories
  useEffect(() => {
    fetch(`/api/${locale}/categories`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.categories.length > 0) {
          setCategories(data.categories);
        }
      })
      .catch(() => {});
  }, [locale]);

  // Fetch index for the active category (polling fallback, 5s — Phase 1 spec)
  const loadRankings = useCallback(() => {
    fetch(`/api/${locale}/index/${activeCategorySlug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRankings(data.rankings || []);
          if (data.category) setActiveCategoryId(data.category.id);
        }
      })
      .catch(() => {});
  }, [activeCategorySlug, locale]);

  useEffect(() => {
    loadRankings();
    const interval = setInterval(loadRankings, 5000);
    return () => clearInterval(interval);
  }, [loadRankings]);

  const handleSelectCategory = (slug: string) => {
    setActiveCategorySlug(slug);
    const cat = categories.find((c) => c.slug === slug);
    if (cat) setActiveCategoryId(cat.id);
  };

  const handleOpenClaimModal = (position: number) => {
    const cat = categories.find((c) => c.slug === activeCategorySlug);
    if (cat) setActiveCategoryId(cat.id);
    setTargetPosition(position);
    setIsClaimModalOpen(true);
  };

  const handleSurpriseMe = async () => {
    try {
      const res = await fetch(`/api/${locale}/companies/random`);
      const data = await res.json();
      if (!data.success || !data.company?.id || !data.company?.categorySlug) return;
      setHighlightCompanyId(null);
      setActiveCategorySlug(data.company.categorySlug);
      const cat = categories.find((c) => c.slug === data.company.categorySlug);
      if (cat) setActiveCategoryId(cat.id);
      setHighlightCompanyId(data.company.id);
      setHighlightSeq((n) => n + 1);
    } catch {
      // Random fetch failed — keep the board as-is, harmless.
    }
  };

  const handleHighlightHandled = () => setHighlightCompanyId(null);

  const champion = rankings.find((r) => r.position === 1);
  const categoryName =
    categories.find((c) => c.slug === activeCategorySlug)?.name ?? activeCategorySlug;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar
        locale={locale}
        categories={categories}
        activeCategorySlug={activeCategorySlug}
        onSelectCategory={handleSelectCategory}
        t={t as any}
        onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
        onSurpriseMe={handleSurpriseMe}
      />

      <main className="flex-1">
        <HeroBanner
          categoryName={categoryName}
          topAmountCents={champion?.currentAmountCents ?? null}
          topHolderName={champion?.company.name}
          t={t as any}
        />

        <TotalCommitted locale={locale} t={t as any} />

        <div aria-live="polite" aria-atomic="false">
          <LeaderboardTable
            categories={categories}
            activeCategorySlug={activeCategorySlug}
            onSelectCategory={handleSelectCategory}
            rankings={rankings}
            locale={locale}
            t={t as any}
            onClaimPosition={handleOpenClaimModal}
            highlightCompanyId={highlightCompanyId}
            highlightNonce={highlightSeq}
            onHighlightHandled={handleHighlightHandled}
          />
        </div>

        {/* Ambient feed sits below the list, deliberately understated */}
        <LiveActivityFeed locale={locale} categorySlug={activeCategorySlug} t={t as any} />

        {/* Independent of the paid index above — real-world market context */}
        <GlobalMarketsSection locale={locale} t={t as any} />
      </main>

      <footer className="border-t-hairline bg-paper">
        <div className="mx-auto flex max-w-content flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-ink-60 sm:flex-row sm:px-8">
          <div className="font-display text-sm font-semibold text-ink">The Tech Founders List</div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href={`/${locale}/legal`} className="underline decoration-ink/20 underline-offset-2 hover:text-ink">
              {t('footer.refundPolicy')}
            </Link>
            <span className="font-data num-ltr">{t('footer.minIncrement')}</span>
            <span>{t('footer.paypalSecured')}</span>
          </div>
        </div>
      </footer>

      <ClaimPositionModal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        position={targetPosition}
        categoryId={activeCategoryId}
        categorySlug={activeCategorySlug}
        t={t as any}
        locale={locale}
        onClaimSuccess={loadRankings}
      />

      <SubmitCompanyModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        categories={categories}
        locale={locale}
        t={t as any}
      />
    </div>
  );
}
