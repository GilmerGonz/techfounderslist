'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import clsx from 'clsx';
import { ExternalLink, Plus, BadgeCheck } from 'lucide-react';
import { IndexTicker } from './TelemetryTicker';
import { companyTicker } from '@/lib/companyTicker';

gsap.registerPlugin(useGSAP);

interface Project {
  id: string;
  name: string;
  url: string;
  logoUrl?: string;
  description?: string;
  verified?: boolean;
}

interface Ranking {
  position: number;
  currentAmountCents: number;
  heldSince: string | Date;
  company: Project;
}

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface LeaderboardTableProps {
  categories: Category[];
  activeCategorySlug: string;
  onSelectCategory: (slug: string) => void;
  rankings: Ranking[];
  locale: string;
  t: (key: string, values?: any) => string;
  onClaimPosition: (position: number) => void;
  highlightCompanyId?: string | null;
  highlightNonce?: number;
  onHighlightHandled?: () => void;
}

function formatDuration(fromMs: number): string {
  const diff = Math.max(0, Date.now() - fromMs);
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * The signature screen element — each position is a discrete white card,
 * almost collectible: it was individually purchased. Position reflow animates
 * at 220ms ease-out; the #1 position carries a small brass underline beneath
 * its number (no celebratory color flash).
 */
export function LeaderboardTable({
  categories,
  activeCategorySlug,
  onSelectCategory,
  rankings,
  locale,
  t,
  onClaimPosition,
  highlightCompanyId,
  highlightNonce = 0,
  onHighlightHandled,
}: LeaderboardTableProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const animatedKeyRef = useRef('');
  const [outbidAt, setOutbidAt] = useState<Record<string, number>>({});
  const prevPositionsRef = useRef<Record<string, number>>({});

  const champion = rankings.find((r) => r.position === 1);

  // Staggered row entrance on first load and on category switch
  useGSAP(
    () => {
      if (!listRef.current || rankings.length === 0) return;
      const key = `${activeCategorySlug}:${rankings.length}`;
      if (animatedKeyRef.current === key) return;
      animatedKeyRef.current = key;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      gsap.fromTo(
        Array.from(listRef.current.children),
        { y: 16, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.4,
          ease: 'power3.out',
          stagger: 0.045,
          clearProps: 'transform,opacity',
        }
      );
    },
    { dependencies: [activeCategorySlug, rankings.length] }
  );

  // Track displacement moments client-side for the "Outranked Xm ago" meta line
  useEffect(() => {
    const next: Record<string, number> = {};
    const prev = prevPositionsRef.current;
    rankings.forEach((r) => {
      const before = prev[r.company.id];
      if (before !== undefined && r.position > before && !outbidAt[r.company.id]) {
        next[r.company.id] = Date.now();
      }
    });
    prevPositionsRef.current = Object.fromEntries(rankings.map((r) => [r.company.id, r.position]));
    if (Object.keys(next).length > 0) setOutbidAt((o) => ({ ...o, ...next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankings]);

  // "Surprise me" — when a company to spotlight arrives (possibly after a
  // category switch), scroll it into view and give it a brief brass flash.
  // Re-fires on every click (highlightNonce), even when the same company is
  // picked twice. Follows the useGSAP pattern: honors prefers-reduced-motion
  // (instant flash, no scroll smoothing) and always returns the card to its
  // paper-white background once the flash fades.
  useGSAP(
    () => {
      if (!highlightCompanyId) return;
      let attempts = 0;

      const spotlight = () => {
        attempts += 1;
        const el = listRef.current?.querySelector(
          `[data-company-id="${CSS.escape(highlightCompanyId)}"]`
        );
        if (!el) {
          // Category just switched — the new rankings may not be loaded yet.
          // Poll the DOM briefly without churning the dependency array.
          if (attempts < 24) gsap.delayedCall(0.25, spotlight);
          return;
        }

        const row = (el as HTMLElement).querySelector(':scope > div');
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
          (el as HTMLElement).scrollIntoView({ behavior: 'auto', block: 'center' });
          gsap.set(row || el, { backgroundColor: 'rgba(186,154,74,0.18)' });
        } else {
          (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
          gsap.fromTo(
            row || el,
            { backgroundColor: 'rgba(186,154,74,0.18)' },
            {
              backgroundColor: 'rgba(255,255,255,0)',
              duration: 1.6,
              ease: 'power2.out',
              clearProps: 'backgroundColor',
            }
          );
        }

        // Clear the spotlight once the flash has played so the next click
        // re-fires cleanly (see highlightNonce) and nothing stays glued.
        gsap.delayedCall(1.8, () => {
          if (prefersReducedMotion) gsap.set(row || el, { clearProps: 'backgroundColor' });
          onHighlightHandled?.();
        });
      };

      spotlight();
    },
    { dependencies: [highlightCompanyId, highlightNonce] }
  );

  const VISIBLE_SPOTS = 20;
  const fullPositions: Array<{ position: number; ranking?: Ranking }> = Array.from(
    { length: Math.max(VISIBLE_SPOTS, rankings.length) },
    (_, i) => ({
      position: i + 1,
      ranking: rankings.find((r) => r.position === i + 1),
    })
  );

  return (
    <section className="mx-auto max-w-content px-4 pb-16 sm:px-8">
      {/* Mobile category pills (primary action must stay visible & tappable) */}
      <div className="mb-5 flex gap-1 overflow-x-auto md:hidden" role="tablist">
        {categories.map((cat) => (
          <button
            key={cat.id}
            role="tab"
            aria-selected={cat.slug === activeCategorySlug}
            onClick={() => onSelectCategory(cat.slug)}
            className={clsx(
              'whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs',
              cat.slug === activeCategorySlug ? 'bg-ink font-semibold text-paper' : 'text-ink-60'
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Empty category — invitation, not filler */}
      {rankings.length === 0 ? (
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-lg bg-paper px-8 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border-hairline border-ink/20">
            <Plus className="h-6 w-6 text-ink" strokeWidth={1.5} />
          </span>
          <h3 className="mt-4 font-display text-xl font-bold text-ink">
            {t('leaderboard.emptyTitle')}
          </h3>
          <p className="mt-1 text-sm text-ink-60">{t('leaderboard.emptyBody')}</p>
            <button
              onClick={() => onClaimPosition(1)}
              className="mt-6 rounded-sm bg-ledger-green px-5 py-2.5 text-sm font-bold text-paper transition-transform hover:brightness-105 active:scale-[0.98]"
            >
              {t('common.submitProject')}
            </button>
        </div>
      ) : (
        <ol ref={listRef} className="space-y-3">
          {fullPositions.map(({ position, ranking }) => {
            const isTop1 = position === 1;

            if (!ranking) {
              // Open spot — quiet invitation row
              return (
                <li key={`open-${position}`}>
                  <button
                    onClick={() => onClaimPosition(position)}
                    className="group flex w-full items-center justify-between rounded-md border border-dashed border-ink/15 px-6 py-5 text-start transition-colors hover:border-ink/30 hover:bg-white/60"
                  >
                    <span className="font-display text-base font-medium text-ink-30 group-hover:text-ink-60">
                      #{position} · {t('leaderboard.openSpot')}
                    </span>
                    <span className="font-data text-sm font-tabular num-ltr text-ink-60">
                      {t('leaderboard.claimFrom', { amount: '$1.00' })}
                    </span>
                  </button>
                </li>
              );
            }

            const heldMs = new Date(ranking.heldSince).getTime();
            const displacedAt = outbidAt[ranking.company.id];
            const metaLine =
              isTop1 || !displacedAt
                ? t('leaderboard.reigning', { duration: formatDuration(heldMs) })
                : t('leaderboard.outbidAgo', { duration: formatDuration(displacedAt) });

            return (
              <motion.li
                key={ranking.company.id}
                data-company-id={ranking.company.id}
                layout
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <div
                  className="flex flex-col gap-3 rounded-md border-hairline border-ink/10 bg-white p-5 transition-[transform,border-color] duration-200 hover:-translate-y-px hover:border-ink/25 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                >
                  {/* Rank cluster */}
                  <div className="flex min-w-0 items-center gap-4">
                    {isTop1 ? (
                      <span className="flex w-14 shrink-0 flex-col items-start">
                        <span className="font-display text-lg font-bold text-ink num-ltr">1</span>
                        <span className="mt-0.5 h-[2px] w-6 bg-brass" />
                        <span className="mt-1.5 whitespace-nowrap rounded-[3px] bg-brass/10 px-1.5 py-0.5 font-data font-tabular num-ltr text-[10px] leading-none text-brass">
                          {t('leaderboard.championReign', { duration: formatDuration(heldMs) })}
                        </span>
                      </span>
                    ) : (
                      <span className="w-7 shrink-0 text-end font-display text-lg font-bold text-ink num-ltr">
                        {position}
                      </span>
                    )}

                    {ranking.company.logoUrl ? (
                      <img
                        src={ranking.company.logoUrl}
                        alt=""
                        width={36}
                        height={36}
                        className="h-9 w-9 shrink-0 rounded-sm border-hairline border-ink/10 object-cover"
                      />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-paper font-display font-bold text-ink">
                        {ranking.company.name.charAt(0)}
                      </span>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                         <span className="truncate font-display text-[15px] font-medium text-ink">
                           {ranking.company.name}
                         </span>
                         <span className="shrink-0 rounded-[3px] border border-ink/15 px-1 py-px font-data font-tabular num-ltr text-[10px] leading-none text-ink-60">
                           ${companyTicker(ranking.company.name)}
                         </span>
                         {ranking.company.verified && (
                           <BadgeCheck
                             className="h-4 w-4 shrink-0 text-ledger-green"
                             strokeWidth={2}
                             aria-label="Verified company"
                           />
                         )}
                        <a
                          href={ranking.company.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${ranking.company.name} website`}
                          className="text-ink-30 transition-colors hover:text-ink"
                        >
                          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </a>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-60">{metaLine}</p>
                    </div>
                  </div>

                  {/* Ticker + action */}
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <IndexTicker
                      amountCents={ranking.currentAmountCents}
                      locale={locale}
                    />
                    <button
                      onClick={() => onClaimPosition(position)}
                      className="rounded-sm border-hairline border-ink/15 px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-paper"
                    >
                      {t('leaderboard.claimNow')}{' '}
                      <span className="font-data font-tabular num-ltr">
                        {new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(
                          (ranking.currentAmountCents + 100) / 100
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              </motion.li>
            );
          })}

          {/* Every spot beyond the board is always claimable too */}
          <li>
            <button
              onClick={() => onClaimPosition(fullPositions.length + 1)}
              className="group flex w-full items-center justify-between rounded-md border border-dashed border-ink/15 px-6 py-5 text-start transition-colors hover:border-ink/30 hover:bg-white/60"
            >
              <span className="font-display text-base font-medium text-ink-30 group-hover:text-ink-60">
                #{fullPositions.length + 1} · {t('leaderboard.openSpot')}
              </span>
              <span className="font-data text-sm font-tabular num-ltr text-ink-60">
                {t('leaderboard.claimFrom', { amount: '$1.00' })}
              </span>
            </button>
          </li>
        </ol>
      )}
    </section>
  );
}
