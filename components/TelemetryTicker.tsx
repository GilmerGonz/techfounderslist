'use client';

import React, { useMemo, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import clsx from 'clsx';

gsap.registerPlugin(useGSAP);

interface IndexTickerProps {
  /** Monetary amount in integer cents */
  amountCents: number;
  locale?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Index Ticker — The Tech Founders List's signature element.
 * Every position figure renders as an Ink-outlined pill (not filled)
 * containing IBM Plex Mono tabular numerals.
 * Digits perform a fast, quiet tabular roll (120-160ms, linear easing).
 * Digits always read left-to-right, even RTL.
 */
export function IndexTicker({
  amountCents,
  locale = 'en',
  size = 'md',
  className,
}: IndexTickerProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const prevAmountRef = useRef<number | null>(null);

  const formatted = useMemo(
    () =>
      new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(
        amountCents / 100
      ),
    [amountCents, locale]
  );

  const chars = useMemo(() => Array.from(formatted), [formatted]);
  const prevCharsRef = useRef<string[]>([]);

  useGSAP(
    () => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isFirstRender = prevAmountRef.current === null;

      if (!prefersReducedMotion && !isFirstRender && containerRef.current) {
        const digitEls = containerRef.current.querySelectorAll<HTMLElement>('[data-char]');
        chars.forEach((char, i) => {
          if (prevCharsRef.current[i] !== char && digitEls[i]) {
            // Fast tabular roll — 140ms, linear, no bounce, no overshoot
            gsap.fromTo(
              digitEls[i],
              { yPercent: 50, opacity: 0 },
              { yPercent: 0, opacity: 1, duration: 0.14, ease: 'none', delay: i * 0.02 }
            );
          }
        });
      }

      prevCharsRef.current = chars;
      prevAmountRef.current = amountCents;
    },
    { scope: containerRef, dependencies: [formatted] }
  );

  return (
    <span
      className={clsx(
        'inline-flex items-center num-ltr font-data font-tabular whitespace-nowrap rounded-sm border border-ink/12 bg-transparent text-ink',
        size === 'sm' && 'px-2.5 py-1 text-[11px]',
        size === 'md' && 'px-3.5 py-2 text-sm',
        size === 'lg' && 'px-5 py-3 text-xl font-semibold',
        className
      )}
    >
      <span ref={containerRef} className="inline-flex overflow-hidden">
        {chars.map((char, i) => (
          <span key={`${i}-${char}`} data-char className="inline-block will-change-transform">
            {char}
          </span>
        ))}
      </span>
    </span>
  );
}
