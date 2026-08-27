'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { X, ShieldAlert, CheckCircle2, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';

const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

// Persists the company created in stage A (name/url/email/token) so that if
// the browser is closed/crashes between company creation and a completed
// payment, reopening the same claim resumes with the SAME company instead of
// creating a duplicate (and losing the only copy of the ownership token).
const PENDING_CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

interface PendingClaim {
  companyId: string;
  companyToken: string;
  companyName: string;
  companyUrl: string;
  logoUrl: string;
  description: string;
  ownerEmail: string;
  billingCountry: string;
  billingTaxId: string;
  amountDollars: string;
  savedAt: number;
}

function pendingClaimKey(categoryId: string, position: number): string {
  return `tfl:pending-claim:${categoryId}:${position}`;
}

function loadPendingClaim(categoryId: string, position: number): PendingClaim | null {
  try {
    const raw = window.localStorage.getItem(pendingClaimKey(categoryId, position));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingClaim;
    if (Date.now() - parsed.savedAt > PENDING_CLAIM_TTL_MS) {
      window.localStorage.removeItem(pendingClaimKey(categoryId, position));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function savePendingClaim(categoryId: string, position: number, data: Omit<PendingClaim, 'savedAt'>): void {
  try {
    window.localStorage.setItem(
      pendingClaimKey(categoryId, position),
      JSON.stringify({ ...data, savedAt: Date.now() })
    );
  } catch {
    /* localStorage unavailable (private mode, quota) — resume just won't work */
  }
}

function clearPendingClaim(categoryId: string, position: number): void {
  try {
    window.localStorage.removeItem(pendingClaimKey(categoryId, position));
  } catch {
    /* no-op */
  }
}

interface ClaimPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: number;
  categoryId: string;
  categorySlug: string;
  t: (key: string, values?: any) => string;
  locale: string;
  onClaimSuccess: () => void;
}

type Stage = 'form' | 'payment' | 'success' | 'refunded';

export function ClaimPositionModal({
  isOpen,
  onClose,
  position,
  categoryId,
  t,
  locale,
  onClaimSuccess,
}: ClaimPositionModalProps) {
  const [stage, setStage] = useState<Stage>('form');
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [minRequiredCents, setMinRequiredCents] = useState(100);
  const [currentHolderName, setCurrentHolderName] = useState<string | null>(null);

  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [billingCountry, setBillingCountry] = useState('');
  const [billingTaxId, setBillingTaxId] = useState('');
  const [amountDollars, setAmountDollars] = useState('');

  const [orderId, setOrderId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Demo-mode state (no PayPal configured)
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyToken, setCompanyToken] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [claimAmountCents, setClaimAmountCents] = useState(0);

  // FIX D-01: Reset ALL form fields whenever modal opens or position changes
  useEffect(() => {
    if (!isOpen) return;

    // Reset stage and errors
    setStage('form');
    setErrorMessage(null);
    setOrderId(null);
    setDemoMode(false);
    setCompanyId(null);
    setCompanyToken(null);
    setClaimAmountCents(0);
    setLoadingQuote(true);

    // FIX D-01: Reset all form fields
    setCompanyName('');
    setCompanyUrl('');
    setLogoUrl('');
    setDescription('');
    setOwnerEmail('');
    setBillingCountry('');
    setBillingTaxId('');
    setAmountDollars('');
    setCurrentHolderName(null);

    // Resume an in-flight claim for this exact position: if the company was
    // already created (e.g. the browser closed before payment completed),
    // reuse it instead of creating a duplicate and losing the only copy of
    // the ownership token.
    const pending = loadPendingClaim(categoryId, position);
    if (pending) {
      setCompanyName(pending.companyName);
      setCompanyUrl(pending.companyUrl);
      setLogoUrl(pending.logoUrl);
      setDescription(pending.description);
      setOwnerEmail(pending.ownerEmail);
      setBillingCountry(pending.billingCountry);
      setBillingTaxId(pending.billingTaxId);
      setAmountDollars(pending.amountDollars);
      setCompanyId(pending.companyId);
      setCompanyToken(pending.companyToken);
    }

    fetch(`/api/${locale}/positions/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, position }),
    })
      .then((res) => res.json())
      .then((data) => {
        setLoadingQuote(false);
        if (data.success && data.quote) {
          setMinRequiredCents(data.quote.minRequiredCents);
          // Keep a resumed amount if it still clears the (possibly higher,
          // since prices only move up) fresh minimum; otherwise reset to it.
          const resumedCents = Math.round(parseFloat(pending?.amountDollars ?? '') * 100);
          setAmountDollars(
            pending && Number.isFinite(resumedCents) && resumedCents >= data.quote.minRequiredCents
              ? pending.amountDollars
              : (data.quote.minRequiredCents / 100).toFixed(2)
          );
          setCurrentHolderName(data.quote.currentHolder?.name ?? null);
        }
      })
      .catch((err) => {
        setLoadingQuote(false);
        setErrorMessage(err.message);
      });
  }, [isOpen, categoryId, position, locale]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const fmtUSD = (cents: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(cents / 100);

  // Stage A -> creates company, then a PayPal Order for the exact amount
  const handlePreparePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const amountCents = Math.round(parseFloat(amountDollars) * 100);
    if (!Number.isFinite(amountCents) || amountCents < minRequiredCents) {
      setErrorMessage(
        t('claimModal.tooLow', { amount: fmtUSD(minRequiredCents) })
      );
      return;
    }
    if (!companyName || !companyUrl || !ownerEmail) {
      setErrorMessage(t('claimModal.missingFields'));
      return;
    }

    setProcessing(true);

    try {
      // Resume the company from a previous, interrupted attempt at this exact
      // position (see loadPendingClaim above) instead of creating a duplicate
      // and orphaning the earlier one's ownership token.
      let activeCompanyId: string;
      let activeCompanyToken: string;

      if (companyId && companyToken) {
        activeCompanyId = companyId;
        activeCompanyToken = companyToken;
      } else {
        const companyRes = await fetch(`/api/${locale}/companies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryId,
            name: companyName,
            url: companyUrl,
            logoUrl: logoUrl || undefined,
            description: description || undefined,
            ownerEmail,
            billingCountry: billingCountry || undefined,
            billingTaxId: billingTaxId || undefined,
          }),
        });
        const companyData = await companyRes.json();
        if (!companyData.success) throw new Error(companyData.error || 'Failed to register company');
        activeCompanyId = companyData.company.id;
        activeCompanyToken = companyData.token;
      }

      savePendingClaim(categoryId, position, {
        companyId: activeCompanyId,
        companyToken: activeCompanyToken,
        companyName,
        companyUrl,
        logoUrl,
        description,
        ownerEmail,
        billingCountry,
        billingTaxId,
        amountDollars,
      });

       const checkoutRes = await fetch(`/api/${locale}/positions/checkout`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           companyId: activeCompanyId,
           companyToken: activeCompanyToken,
           categoryId,
           position,
           amountCents,
         }),
       });
       const checkoutData = await checkoutRes.json();
       if (!checkoutData.success) throw new Error(checkoutData.error || 'Checkout failed');

       // Demo mode: no real PayPal order — simulate capture client-side
       if (checkoutData.mode === 'demo') {
         setCompanyId(activeCompanyId);
         setCompanyToken(activeCompanyToken);
         setClaimAmountCents(amountCents);
         setDemoMode(true);
         setStage('payment');
         return;
       }

       setCompanyId(activeCompanyId);
       setCompanyToken(activeCompanyToken);
       setOrderId(checkoutData.orderId);
       setStage('payment');
     } catch (err: any) {
       setErrorMessage(err.message);
     } finally {
       setProcessing(false);
     }
   };

  // Demo-mode: simulate a successful payment capture without PayPal
  const handleDemoPay = async () => {
    if (!companyId || !companyToken) return;
    setProcessing(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/${locale}/positions/demo-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          companyToken,
          categoryId,
          position,
          amountCents: claimAmountCents,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Demo claim failed');
      clearPendingClaim(categoryId, position);
      setStage('success');
      onClaimSuccess();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // FIX D-03: Retry handler for PayPal errors
  const handleRetryFromPayment = () => {
    setStage('form');
    setOrderId(null);
    setDemoMode(false);
    setErrorMessage(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="claim-modal-title"
            className="relative w-full max-w-lg rounded-lg border-hairline border-ink/10 bg-white px-10 py-8 text-ink sm:px-12 sm:py-10"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute end-6 top-6 text-ink-30 transition-colors hover:text-ink"
            >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>

        {/* Header */}
        <div className="border-b border-hairline border-ink/10 pb-6">
            <h3 id="claim-modal-title" className="font-display text-xl font-bold">{t('claimModal.title', { position })}</h3>
          <p className="mt-1.5 text-xs text-ink-60">{t('claimModal.subtitle')}</p>
        </div>

        {/* Displacement notice — factual, no apology */}
        {stage === 'form' && currentHolderName && (
          <div className="mt-5 flex items-start gap-2.5 rounded-md bg-paper p-3.5 text-xs text-ink-60">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span>
              {t('claimModal.displacementWarning')}{' '}
              <strong className="font-semibold text-ink">{currentHolderName}</strong>.
            </span>
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="mt-4 rounded-md bg-ledger-green/10 p-3 text-xs text-ledger-green-900">
            {errorMessage}
          </div>
        )}

        {stage === 'success' && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2.5 rounded-md bg-confirmed p-4 text-sm font-medium text-ink">
              <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={1.5} />
              {t('claimModal.paymentConfirmed')}
            </div>

            {companyId && companyToken && (
              <div className="rounded-md bg-paper p-4">
                <p className="text-xs font-semibold text-ink">Save this link — it is the only way to manage your position later.</p>
                <p className="mt-1 text-xs text-ink-60">
                  Use it to enable AutoDefend (automatic re-bidding if you get displaced) or check your status. It is not emailed anywhere.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    readOnly
                    value={
                      typeof window !== 'undefined'
                        ? `${window.location.origin}/${locale}/manage?${new URLSearchParams({
                            companyId,
                            token: companyToken,
                            categoryId,
                            position: String(position),
                          }).toString()}`
                        : ''
                    }
                    onFocus={(e) => e.currentTarget.select()}
                    className="num-ltr w-full rounded-sm border-hairline border-ink/15 bg-white px-3 py-2 text-xs text-ink-60"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = (e.currentTarget.previousSibling as HTMLInputElement | null);
                      if (input) {
                        input.select();
                        navigator.clipboard?.writeText(input.value).catch(() => {});
                      }
                    }}
                    className="shrink-0 rounded-sm border-hairline border-ink/15 px-3 py-2 text-xs font-semibold text-ink hover:bg-white"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-ink px-4 py-3 text-sm font-bold text-paper transition-transform hover:brightness-110 active:scale-[0.99]"
            >
              {t('claimModal.close') || 'Close'}
            </button>
          </div>
        )}

        {/* Refund notification stage */}
        {stage === 'refunded' && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2.5 rounded-md bg-brass/20 p-4 text-sm font-medium text-brass-900">
              <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={1.5} />
              {t('claimModal.refundIssued')}
            </div>
            <button
              onClick={handleRetryFromPayment}
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-ledger-green px-4 py-3 text-sm font-bold text-ink transition-transform hover:brightness-105 active:scale-[0.99]"
            >
              <RotateCcw className="h-4 w-4" />
              {t('claimModal.tryAgain')}
            </button>
          </div>
        )}

        {/* Stage A — details */}
        {stage === 'form' && (
          <form onSubmit={handlePreparePayment} className="mt-7 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">{t('claimModal.projectName')} *</span>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t('claimModal.projectNamePlaceholder')}
                  className="w-full rounded-sm border-hairline border-ink/15 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold">{t('claimModal.projectUrl')} *</span>
                <input
                  type="url"
                  required
                  value={companyUrl}
                  onChange={(e) => setCompanyUrl(e.target.value)}
                  placeholder={t('claimModal.projectUrlPlaceholder')}
                  className="w-full rounded-sm border-hairline border-ink/15 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">{t('claimModal.ownerEmail')} *</span>
                <input
                  type="email"
                  required
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder={t('claimModal.ownerEmailPlaceholder')}
                  className="w-full rounded-sm border-hairline border-ink/15 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold">{t('claimModal.logoUrl')}</span>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://.../logo.png"
                  className="w-full rounded-sm border-hairline border-ink/15 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold">{t('claimModal.projectDescription')}</span>
              <input
                type="text"
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('claimModal.descriptionPlaceholder')}
                className="w-full rounded-sm border-hairline border-ink/15 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">{t('claimModal.billingCountry')}</span>
                <input
                  type="text"
                  maxLength={100}
                  value={billingCountry}
                  onChange={(e) => setBillingCountry(e.target.value)}
                  placeholder={t('claimModal.billingCountryPlaceholder')}
                  className="w-full rounded-sm border-hairline border-ink/15 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">{t('claimModal.billingTaxId')}</span>
                <input
                  type="text"
                  maxLength={50}
                  value={billingTaxId}
                  onChange={(e) => setBillingTaxId(e.target.value)}
                  placeholder={t('claimModal.billingTaxIdPlaceholder')}
                  className="w-full rounded-sm border-hairline border-ink/15 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30"
                />
              </label>
            </div>

            {/* Amount — the one loud element, rendered as telemetry */}
            <div className="rounded-md bg-paper p-5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">{t('claimModal.bidAmount')}</span>
                <span className="text-ink-60">
                  {t('claimModal.minimumNotice', { amount: fmtUSD(minRequiredCents) })}
                </span>
              </div>
              <div className="relative mt-2">
                <input
                  type="number"
                  step="0.01"
                  min={(minRequiredCents / 100).toFixed(2)}
                  required
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                  aria-label={t('claimModal.bidAmount')}
                  className="num-ltr w-full rounded-sm border-hairline border-ink/10 bg-ink px-5 py-3.5 text-right font-data text-lg font-bold font-tabular text-paper focus:outline-none"
                />
              </div>
            </div>

              <button
                type="submit"
                disabled={processing || loadingQuote}
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-white border border-ink px-4 py-3.5 text-sm font-bold text-ink transition-transform hover:brightness-105 active:scale-[0.99] disabled:opacity-50"
              >
              {processing || loadingQuote ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('claimModal.continueToPayment')
              )}
            </button>
          </form>
        )}

        {/* Stage B — Payment (PayPal or Demo) */}
        {stage === 'payment' &&
          (demoMode ? (
            <div className="mt-7 space-y-4">
              <div className="rounded-md bg-paper p-4 text-xs text-ink-60">
                <p className="font-semibold text-ink">{t('claimModal.demoModeTitle')}</p>
                <p className="mt-1.5">{t('claimModal.demoModeBody')}</p>
              </div>
              <button
                onClick={handleDemoPay}
                disabled={processing}
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-ledger-green px-4 py-3.5 text-sm font-bold text-ink transition-transform hover:brightness-105 active:scale-[0.99] disabled:opacity-50"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('claimModal.simulatePayment')
                )}
              </button>
              <button
                onClick={handleRetryFromPayment}
                className="flex w-full items-center justify-center gap-2 rounded-sm border-hairline border-ink/15 px-4 py-2.5 text-xs font-medium text-ink-60 transition-colors hover:bg-paper hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('claimModal.goBack')}
              </button>
            </div>
          ) : paypalClientId && orderId ? (
            <div className="mt-7">
              <PayPalScriptProvider
                options={{ clientId: paypalClientId, currency: 'USD', intent: 'capture' }}
              >
                <PayPalButtons
                  createOrder={() => Promise.resolve(orderId as string)}
                  onApprove={async (data) => {
                    try {
                      const res = await fetch(`/api/${locale}/positions/capture`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderId: data.orderID }),
                      });
                      const json = await res.json();

                      // Handle refund case from server
                      if (json.refunded) {
                        setErrorMessage(json.error);
                        setStage('refunded');
                        return;
                      }

                      if (!json.success) throw new Error(json.error || 'Capture failed');
                      clearPendingClaim(categoryId, position);
                      setStage('success');
                      onClaimSuccess();
                    } catch (err: any) {
                      setErrorMessage(err.message);
                    }
                  }}
                  onError={() => {
                    setErrorMessage(t('claimModal.paypalError'));
                  }}
                  style={{
                    layout: 'vertical',
                    color: 'gold',
                    shape: 'rect',
                    label: 'pay',
                    height: 48,
                  }}
                />
              </PayPalScriptProvider>

              {/* FIX D-03: Add retry button */}
              <button
                onClick={handleRetryFromPayment}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-sm border-hairline border-ink/15 px-4 py-2.5 text-xs font-medium text-ink-60 transition-colors hover:bg-paper hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('claimModal.goBack')}
              </button>

              {/* FIX P-07: Internationalized disclaimer text */}
              <p className="mt-4 text-xs leading-relaxed text-ink-60">
                {t('claimModal.bidDisclaimer')}
              </p>
            </div>
          ) : (
            <p className="mt-5 text-sm text-ledger-green-900">{t('claimModal.paymentNotConfigured')}</p>
          ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
