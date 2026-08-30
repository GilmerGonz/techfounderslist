'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { getTopStartups, type StartupValuation } from '@/lib/data/topStartups';
import type { StockQuote } from '@/app/api/[locale]/markets/stocks/route';
import type { CryptoQuote } from '@/app/api/[locale]/markets/crypto/route';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const POLL_MS = 60_000;

const CRYPTO_LABELS: Record<string, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
  binancecoin: 'BNB',
};

const STOCK_NAMES: Record<string, string> = {
  AAPL: 'Apple',
  NVDA: 'Nvidia',
  TSLA: 'Tesla',
  GOOGL: 'Alphabet',
  MSFT: 'Microsoft',
};

type FetchState<T> = { status: 'loading' | 'success' | 'error'; data: T; stale?: boolean };

interface GlobalMarketsSectionProps {
  locale: string;
  t: (key: string, values?: any) => string;
}

interface QuoteRow {
  id: string; // symbol for stocks, coin id for crypto
  name: string;
  price: number;
  changePct: number;
  kind: 'stock' | 'crypto';
}

/**
 * Global Markets — an editorial, terminal-grade context band independent of
 * the paid index above. Four KPI cards, a CSS bar chart comparing daily
 * moves, and hairline-divided quote/valuation lists. Each source
 * (startups/stocks/crypto) fails or loads on its own; one dead API never
 * blanks the section. ScrollTrigger choreographs entrance; prefers-reduced-
 * motion freezes everything static. Pure presentation — no new API calls,
 * the data all comes from the existing markets routes and topStartups.
 */
export function GlobalMarketsSection({ locale, t }: GlobalMarketsSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  const [startups] = useState<StartupValuation[]>(() => getTopStartups());
  const [stocks, setStocks] = useState<FetchState<StockQuote[]>>({ status: 'loading', data: [] });
  const [stocksConfigured, setStocksConfigured] = useState(true);
  const [crypto, setCrypto] = useState<FetchState<CryptoQuote[]>>({ status: 'loading', data: [] });

  useEffect(() => {
    let cancelled = false;

    const loadStocks = () => {
      fetch(`/api/${locale}/markets/stocks`)
        .then((res) => res.json())
        .then((json) => {
          if (cancelled) return;
          if (!json.success) {
            setStocks((prev) => ({ status: 'error', data: prev.data }));
            return;
          }
          if (json.configured === false) {
            setStocksConfigured(false);
            return;
          }
          setStocks({ status: 'success', data: json.quotes ?? [], stale: !!json.stale });
        })
        .catch(() => {
          if (!cancelled) setStocks((prev) => ({ status: 'error', data: prev.data }));
        });
    };

    loadStocks();
    const interval = setInterval(loadStocks, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [locale]);

  useEffect(() => {
    let cancelled = false;

    const loadCrypto = () => {
      fetch(`/api/${locale}/markets/crypto`)
        .then((res) => res.json())
        .then((json) => {
          if (cancelled) return;
          if (!json.success) {
            setCrypto((prev) => ({ status: 'error', data: prev.data }));
            return;
          }
          setCrypto({ status: 'success', data: json.quotes ?? [], stale: !!json.stale });
        })
        .catch(() => {
          if (!cancelled) setCrypto((prev) => ({ status: 'error', data: prev.data }));
        });
    };

    loadCrypto();
    const interval = setInterval(loadCrypto, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [locale]);

  const fmtUSD = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: n >= 1000 ? 0 : 2 }).format(n);
  // Manual compact formatter — Intl's { notation: 'compact', style: 'currency' }
  // renders subtly differently between Node (SSR) and browser ICU data,
  // causing hydration mismatches. Hand-rolled is deterministic everywhere.
  const fmtCompactUSD = (n: number) => {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(0)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
    return `$${n.toFixed(0)}`;
  };
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short' }).format(new Date(iso));
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  const fmtAbsPct = (n: number) => `${Math.abs(n).toFixed(1)}%`;

  /* ------------------------------------------------------------------ */
  /* Derived: quote rows for the chart + live quote column               */
  /* ------------------------------------------------------------------ */
  const quoteRows: QuoteRow[] = useMemo(() => {
    const rows: QuoteRow[] = [];
    if (stocksConfigured && stocks.status === 'success') {
      stocks.data.forEach((q) =>
        rows.push({
          id: q.symbol,
          name: STOCK_NAMES[q.symbol] ?? q.symbol,
          price: q.price,
          changePct: q.changePercent,
          kind: 'stock',
        })
      );
    }
    if (crypto.status === 'success') {
      crypto.data.forEach((c) =>
        rows.push({
          id: c.id,
          name: CRYPTO_LABELS[c.id] ?? c.id,
          price: c.usd,
          changePct: c.usd24hChange,
          kind: 'crypto',
        })
      );
    }
    // Rank by magnitude of daily move — most volatile first.
    return rows.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  }, [stocks, stocksConfigured, crypto]);

  /* ------------------------------------------------------------------ */
  /* KPI derivations                                                      */
  /* ------------------------------------------------------------------ */
  const topCrypto = useMemo(
    () => (crypto.status === 'success' ? [...crypto.data].sort((a, b) => b.usd24hChange - a.usd24hChange)[0] : undefined),
    [crypto]
  );
  const mostVolatile = useMemo(() => quoteRows[0], [quoteRows]);
  const topStartup = startups[0];
  const totalCapital = useMemo(() => startups.reduce((sum, s) => sum + s.valuationUsd, 0), [startups]);

  /* ------------------------------------------------------------------ */
  /* Scroll-triggered entrance choreography                               */
  /* ------------------------------------------------------------------ */
  // Mount-time reveals (header, stat cards, quote column, valuations) —
  // independent of data: they exist from the first render.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const ctx = gsap.context(() => {}, sectionRef);

      ctx.add(() => {
        gsap.utils.toArray<HTMLElement>('[data-gm-reveal]').forEach((el) => {
          gsap.fromTo(
            el,
            { y: 18, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.55,
              ease: 'power3.out',
              scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            }
          );
        });

        gsap.utils.toArray<HTMLElement>('[data-gm-stat]').forEach((el, i) => {
          gsap.fromTo(
            el,
            { y: 16, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.45,
              ease: 'power3.out',
              delay: i * 0.05,
              scrollTrigger: { trigger: el.parentElement || el, start: 'top 88%', once: true },
            }
          );
        });
      });

      return () => ctx.revert();
    },
    { scope: sectionRef }
  );

  // Bar chart — only runs once the quote data actually exists (the bars are
  // rendered asynchronously), scaling in from the baseline.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!chartWrapRef.current || chartWrapRef.current.querySelectorAll('[data-gm-bar]').length === 0) return;
      gsap.fromTo(
        chartWrapRef.current.querySelectorAll('[data-gm-bar]'),
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.06,
          transformOrigin: (_i: number, target: Element) =>
            target.getAttribute('data-dir') === 'pos' ? 'left center' : 'right center',
          scrollTrigger: { trigger: chartWrapRef.current, start: 'top 85%', once: true },
        }
      );
    },
    { scope: sectionRef, dependencies: [quoteRows.length] }
  );

  /* ------------------------------------------------------------------ */
  /* Bar chart geometry                                                   */
  /* ------------------------------------------------------------------ */
  const chartData = quoteRows;
  const maxAbs = Math.max(1, ...chartData.map((r) => Math.abs(r.changePct)));
  // Each half of the chart models `maxAbs`; a bar's reach is its share of a
  // half (0–50% of the container), so labels and bars never collide.
  const barHalfs = chartData.map((r) => (Math.abs(r.changePct) / maxAbs) * 50);

  /* ------------------------------------------------------------------ */
  /* Render                                                               */
  /* ------------------------------------------------------------------ */
  const loaded = (stocksConfigured ? stocks.status === 'success' : true) && crypto.status === 'success';

  return (
    <section
      ref={sectionRef}
      className="mx-auto max-w-content px-4 py-16 sm:px-8 sm:py-24"
      aria-label={t('globalMarkets.sectionTitle')}
    >
      {/* Editorial header */}
      <div data-gm-reveal className="border-t-hairline border-ink/10 pt-8">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.02em] text-ink-60">
          {t('globalMarkets.kicker')}
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-2xl font-bold leading-[1.15] text-ink sm:text-3xl">
          {t('globalMarkets.sectionTitle')}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-60">{t('globalMarkets.sectionSubtitle')}</p>
      </div>

      {/* KPI stat cards */}
      <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-ink/12 bg-ink/12 lg:grid-cols-4">
        <StatCard
          label={t('globalMarkets.kpis.topCrypto')}
          value={topCrypto ? `$${fmtUSD(topCrypto.usd)}` : '—'}
          hint={topCrypto ? `${CRYPTO_LABELS[topCrypto.id] ?? topCrypto.id}` : undefined}
          delta={topCrypto ? topCrypto.usd24hChange : undefined}
          fmtPct={fmtPct}
          loading={crypto.status !== 'success'}
          dataGmStat
        />
        <StatCard
          label={t('globalMarkets.kpis.mostVolatile')}
          value={mostVolatile ? mostVolatile.name : '—'}
          hint={mostVolatile ? `±${fmtAbsPct(mostVolatile.changePct)} today` : undefined}
          delta={mostVolatile ? mostVolatile.changePct : undefined}
          fmtPct={fmtPct}
          loading={!loaded}
          dataGmStat
        />
        <StatCard
          label={t('globalMarkets.kpis.topStartup')}
          value={topStartup ? topStartup.name : '—'}
          hint={topStartup ? t('globalMarkets.startups.lastRound', { date: fmtDate(topStartup.lastRoundDate) }) : undefined}
          delta={topStartup ? topStartup.valuationUsd : undefined}
          fmtCompactUSD={fmtCompactUSD}
          loading={false}
          dataGmStat
        />
        <StatCard
          label={t('globalMarkets.kpis.capitalRepresented')}
          value={fmtCompactUSD(totalCapital)}
          hint={t('globalMarkets.kpis.starupCount', { count: startups.length })}
          loading={false}
          dataGmStat
        />
      </div>

      {/* Chart + live quotes */}
      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* Bar chart — daily moves */}
        <div data-gm-reveal className="lg:col-span-2 rounded-md border border-ink/12 p-6 sm:p-8">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.02em] text-ink-60">
              {t('globalMarkets.chart.title')}
            </h3>
            <span className="font-data font-tabular num-ltr text-[11px] text-ink-30">
              {t('globalMarkets.chart.period')}
            </span>
          </div>

          {!loaded ? (
            <p data-testid="chart-loading" className="mt-8 text-sm text-ink-60">
              {t('globalMarkets.chart.loading')}
            </p>
          ) : chartData.length === 0 ? (
            <p data-testid="chart-empty" className="mt-8 text-sm text-ink-60">
              {t('globalMarkets.chart.empty')}
            </p>
          ) : (
            <div ref={chartWrapRef}>
              {/* Axis labels */}
              <div className="relative mt-6">
                <div className="flex justify-between font-data font-tabular num-ltr text-[11px] text-ink-30">
                  <span>−{fmtAbsPct(maxAbs)}</span>
                  <span className="absolute left-1/2 -translate-x-1/2">0</span>
                  <span>+{fmtAbsPct(maxAbs)}</span>
                </div>
                {/* Hairline axis */}
                <div className="absolute inset-x-0 top-[18px] h-px bg-ink/10">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-ink/25" />
                </div>
              </div>

              {/* Bars — each row: name | centred bar | value */}
              <div className="mt-7 space-y-4">
                {chartData.map((row, i) => {
                  const positive = row.changePct >= 0;
                  const reach = barHalfs[i];
                  return (
                    <div key={row.id} className="flex items-center gap-3 text-xs">
                      <span className="w-20 shrink-0 truncate text-ink">{row.name}</span>
                      <div className="relative h-3 min-w-0 flex-1">
                        {/* centre hairline */}
                        <div className="absolute inset-y-0 left-1/2 w-px bg-ink/15" aria-hidden="true" />
                        <div
                          data-gm-bar
                          data-dir={positive ? 'pos' : 'neg'}
                          className={
                            positive
                              ? 'absolute left-1/2 top-0 h-full rounded-sm bg-ledger-green will-change-transform'
                              : 'absolute right-1/2 top-0 h-full rounded-sm bg-ledger-red will-change-transform'
                          }
                          style={{ width: `${reach}%` }}
                        />
                      </div>
                      <span
                        className={`flex w-14 shrink-0 items-center justify-end gap-1 font-data font-tabular num-ltr ${
                          positive ? 'text-ledger-green' : 'text-ledger-red'
                        }`}
                      >
                        {positive ? (
                          <TrendingUp className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="h-3 w-3" aria-hidden="true" />
                        )}
                        {fmtAbsPct(row.changePct)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex gap-6 font-data font-tabular num-ltr text-[11px] text-ink-60">
                <span><span className="mr-1.5 inline-block h-2 w-2 align-middle bg-ledger-green" aria-hidden="true" />+</span>
                <span><span className="mr-1.5 inline-block h-2 w-2 align-middle bg-ledger-red" aria-hidden="true" />−</span>
              </div>
            </div>
          )}
        </div>

        {/* Live quotes — stocks + crypto in one hairline column */}
        <div data-gm-reveal>
          <h3 className="text-xs font-semibold uppercase tracking-[0.02em] text-ink-60">
            {t('globalMarkets.live.title')}
          </h3>
          {!loaded ? (
            <p className="mt-4 text-sm text-ink-60">{t('globalMarkets.live.loading')}</p>
          ) : chartData.length === 0 ? (
            <p className="mt-4 text-sm text-ink-60">{t('globalMarkets.live.empty')}</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink/5">
              {chartData.map((row) => (
                <li key={row.id} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-ink">{row.name}</span>
                    <span className="shrink-0 font-data font-tabular num-ltr text-[10px] uppercase text-ink-30">
                      {row.id.toUpperCase()}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-1.5 font-data font-tabular num-ltr text-xs">
                    {row.changePct >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5 self-center text-ledger-green" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 self-center text-ledger-red" aria-hidden="true" />
                    )}
                    {fmtUSD(row.price)}{' '}
                    <span className={row.changePct >= 0 ? 'text-ledger-green' : 'text-ledger-red'}>
                      {fmtPct(row.changePct)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {loaded && (stocks.stale || crypto.stale) && (
            <p className="mt-3 text-xs text-ink-30">{t('globalMarkets.live.stale')}</p>
          )}
        </div>
      </div>

      {/* Private valuations — editorial block */}
      <div data-gm-reveal className="mt-12 border-t-hairline border-ink/10 pt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-display text-lg font-semibold text-ink">{t('globalMarkets.startups.title')}</h3>
          <span className="text-xs text-ink-60">{t('globalMarkets.startups.reference')}</span>
        </div>
        <ul className="mt-5 divide-y divide-ink/5">
          {startups.map((s) => (
            <li
              key={s.name}
              className="flex items-baseline justify-between gap-4 py-3 text-sm"
              title={t('globalMarkets.startups.lastRound', { date: fmtDate(s.lastRoundDate) })}
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-ink">{s.name}</span>
                <span className="shrink-0 font-data font-tabular num-ltr text-[10px] uppercase text-ink-30">
                  {s.sector}
                </span>
              </span>
              <span className="shrink-0 font-data font-tabular num-ltr text-sm text-ink-60">
                {fmtCompactUSD(s.valuationUsd)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* StatCard — one KPI tile, terminal-style digits                      */
/* ------------------------------------------------------------------ */
function StatCard({
  label,
  value,
  hint,
  delta,
  fmtPct,
  fmtCompactUSD,
  loading,
  dataGmStat,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Numeric delta shown as +x% (green) or −x% (muted) */
  delta?: number;
  fmtPct?: (n: number) => string;
  fmtCompactUSD?: (n: number) => string;
  loading?: boolean;
  dataGmStat?: boolean;
}) {
  return (
    <div data-gm-stat={dataGmStat ? '' : undefined} className="bg-paper p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.02em] text-ink-60">{label}</p>
      <div className="mt-2 flex min-h-[2rem] items-baseline gap-2">
        <span className="truncate font-data font-tabular num-ltr text-xl text-ink sm:text-2xl" aria-busy={loading}>
          {value}
        </span>
        {delta !== undefined && fmtCompactUSD !== undefined ? (
          <span className="shrink-0 font-data font-tabular num-ltr text-sm text-ledger-green">
            {fmtCompactUSD(delta)}
          </span>
        ) : delta !== undefined && fmtPct ? (
          <span
            className={`shrink-0 font-data font-tabular num-ltr text-sm ${delta >= 0 ? 'text-ledger-green' : 'text-ledger-red'}`}
          >
            {fmtPct(delta)}
          </span>
        ) : null}
      </div>
      {hint && <p className="mt-1 truncate text-xs text-ink-30">{hint}</p>}
    </div>
  );
}
