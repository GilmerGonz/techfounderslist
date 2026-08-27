'use client';

import React, { useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

gsap.registerPlugin(useGSAP);

interface FeedItem {
  id: string;
  companyId: string;
  amountCents: number;
  position: number;
  createdAt: string | Date;
  company?: {
    name: string;
    logoUrl?: string;
  };
}

interface LiveActivityFeedProps {
  locale: string;
  categorySlug: string;
  t: (key: string, values?: any) => string;
}

/**
 * Ambient peripheral feed — deliberately understated. One line per event,
 * Ink-60 text with the amount in mono; new entries slide in gently (200ms).
 */
export function LiveActivityFeed({ locale, categorySlug, t }: LiveActivityFeedProps) {
  const [items, setItems] = React.useState<FeedItem[]>([]);
  const listRef = useRef<HTMLUListElement>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch(`/api/${locale}/index/${categorySlug}/history`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled || !data.success || !Array.isArray(data.claims)) return;
          const incoming: FeedItem[] = data.claims;
          const fresh = incoming.filter((i) => !seenIdsRef.current.has(i.id));
          if (fresh.length === 0) return;
          fresh.forEach((i) => seenIdsRef.current.add(i.id));
          setItems((prev) => {
            const merged = [...fresh, ...prev].slice(0, 8);
            return firstLoadRef.current ? incoming.slice(0, 8) : merged;
          });
          firstLoadRef.current = false;
        })
        .catch(() => {});
    };

    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [locale, categorySlug]);

  // Slide-in for freshly prepended entries
  useGSAP(
    () => {
      if (!listRef.current || items.length === 0) return;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;
      gsap.fromTo(
        listRef.current.querySelectorAll('[data-entry]:first-child'),
        { y: -8, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.2, ease: 'power2.out' }
      );
    },
    { scope: listRef, dependencies: [items.length] }
  );

  if (items.length === 0) return null;

  const fmtAmount = (cents: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(cents / 100);

  return (
    <section className="mx-auto max-w-content px-4 pb-4 sm:px-8" aria-live="polite">
      <ul ref={listRef} className="divide-y divide-ink/5">
        {items.map((item) => (
          <li
            key={item.id}
            data-entry
            className="flex items-center justify-between gap-4 py-2 text-xs text-ink-60"
          >
            <span className="truncate">
              <span className="font-medium text-ink">{item.company?.name ?? '—'}</span>
              {' · '}
              {t('feed.tookSpot', { position: item.position })}
            </span>
            <span className="shrink-0 font-data font-tabular num-ltr">{fmtAmount(item.amountCents)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
