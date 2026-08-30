'use client';

import React, { useEffect, useState } from 'react';
import { IndexTicker } from './TelemetryTicker';

interface TotalCommittedProps {
  locale: string;
  t: (key: string, values?: any) => string;
}

/**
 * All-time committed capital — the sum of every confirmed position claim since
 * the site launched. Starts the counter at the entry price ($1.00) so the
 * TelemetryTicker odometer roll fires once on load, same as the hero stat.
 */
export function TotalCommitted({ locale, t }: TotalCommittedProps) {
  const [totalCents, setTotalCents] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/${locale}/stats/total`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.success) {
          setTotalCents(d.totalCents ?? 0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return (
    <div className="mx-auto max-w-content px-4 sm:px-8">
      <div className="mb-16 flex flex-wrap items-center justify-between gap-4 border-t-hairline bg-paper px-4 py-6 sm:px-6">
        <span className="text-xs font-semibold uppercase tracking-[0.02em] text-ink-60">
          {t('common.totalCommitted')}
        </span>
        <IndexTicker amountCents={totalCents ?? 100} locale={locale} size="lg" />
      </div>
    </div>
  );
}
