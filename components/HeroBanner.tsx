'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { IndexTicker } from './TelemetryTicker';

gsap.registerPlugin(useGSAP);

interface HeroBannerProps {
  categoryName: string;
  /** Current #1 amount in cents (or null when spot is open) */
  topAmountCents: number | null;
  topHolderName?: string;
  t: (key: string, values?: any) => string;
}

/**
 * Utility hero band (~280px), left-aligned to mirror the reading order of
 * the ranking list beneath. Demonstrates the mechanic live instead of
 * describing it: the current #1 price renders inline as a Telemetry Ticker,
 * counting up from $1.00 on first load through the odometer roll.
 */
export function HeroBanner({ categoryName, topAmountCents, topHolderName, t }: HeroBannerProps) {
  const sectionRef = useRef<HTMLElement>(null);
  // Start the public counter at the entry price ($1.00); the switch to the
  // real value fires the TelemetryTicker odometer roll exactly once on mount.
  const [displayCents, setDisplayCents] = useState<number>(100);

  useEffect(() => {
    if (topAmountCents !== null && topAmountCents !== displayCents) {
      const raf = requestAnimationFrame(() => setDisplayCents(topAmountCents));
      return () => cancelAnimationFrame(raf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topAmountCents]);

  // Entrance choreography: eyebrow -> headline -> support -> live stat
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.fromTo(
        '[data-hero-reveal]',
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', stagger: 0.08 }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="mx-auto max-w-content px-4 pb-10 pt-12 sm:px-8">
      <p data-hero-reveal className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.02em] text-ink-60">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ledger-green bg-ledger-green" />
        {t('hero.liveIn', { category: categoryName })}
      </p>

      <h1 data-hero-reveal className="mt-3 max-w-3xl font-display text-3xl font-bold leading-[1.1] text-ink sm:text-4xl lg:text-5xl">
        {t('hero.headline')}
      </h1>

      <p data-hero-reveal className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-60">{t('hero.support')}</p>

      {/* Live stat — the product demonstrating itself */}
      <div data-hero-reveal className="mt-7 flex flex-wrap items-center gap-3">
        <IndexTicker
          amountCents={displayCents}
          size="lg"
        />
        <div className="text-xs text-ink-60">
          {topAmountCents === null ? (
            <>
              <span className="block font-semibold text-ink">{t('hero.openSpotTitle')}</span>
              {t('hero.openSpotBody')}
            </>
          ) : (
            <>
              <span className="block font-semibold text-ink">
                {t('hero.topSpotLabel', { name: topHolderName ?? '' })}
              </span>
              {t('hero.topSpotHint')}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
