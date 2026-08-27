'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck, ShieldOff, AlertTriangle } from 'lucide-react';

/**
 * Minimal position-management page. Reached via the link shown after a
 * successful claim (?companyId=&token=&categoryId=&position=). There is no
 * login system in this app — the ownership token in the URL IS the
 * credential, exactly like the one used at checkout. Not yet localized
 * (next-intl messages only cover the main page) — plain bilingual-neutral
 * copy for now.
 */
export default function ManagePage() {
  const params = useSearchParams();
  const companyId = params.get('companyId') ?? '';
  const token = params.get('token') ?? '';
  const categoryId = params.get('categoryId') ?? '';
  const position = Number(params.get('position'));
  const locale = (params.get('locale') || 'en').toLowerCase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [maxAmountDollars, setMaxAmountDollars] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const valid = !!companyId && !!token && !!categoryId && Number.isInteger(position) && position >= 1;

  useEffect(() => {
    if (!valid) {
      setLoading(false);
      setError('This link is missing required parameters.');
      return;
    }
    const qs = new URLSearchParams({ companyId, token, categoryId, position: String(position) });
    fetch(`/api/${locale}/autodefend?${qs.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setLoading(false);
        if (!data.success) {
          setError(data.error || 'Could not load AutoDefend status.');
          return;
        }
        if (data.subscription) {
          setActive(data.subscription.active);
          setMaxAmountDollars((data.subscription.maxAmountCents / 100).toFixed(2));
        }
      })
      .catch((err) => {
        setLoading(false);
        setError(err.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid]);

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const maxAmountCents = Math.round(parseFloat(maxAmountDollars) * 100);
    try {
      const res = await fetch(`/api/${locale}/autodefend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, companyToken: token, categoryId, position, maxAmountCents }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to enable AutoDefend');
      setActive(true);
      setNotice('AutoDefend is active for this position.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/${locale}/autodefend`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, companyToken: token, categoryId, position }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to disable AutoDefend');
      setActive(false);
      setNotice('AutoDefend has been turned off.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16 text-ink">
      <h1 className="font-display text-2xl font-bold">Manage your position</h1>
      <p className="mt-1.5 text-sm text-ink-60">
        Position #{Number.isFinite(position) ? position : '—'}
      </p>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-ink-60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !valid ? (
        <div className="mt-8 flex items-start gap-2.5 rounded-md bg-ledger-green/10 p-4 text-sm text-ledger-green-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          This link is missing required parameters. Use the management link shown right after your claim was confirmed.
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="rounded-md bg-paper p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {active ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-ledger-green" /> AutoDefend is ON
                </>
              ) : (
                <>
                  <ShieldOff className="h-4 w-4 text-ink-30" /> AutoDefend is OFF
                </>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-60">
              When enabled, if someone outbids you for this exact position, the system automatically
              re-bids on your behalf using the PayPal payment method from your last real (non-demo)
              payment — up to the ceiling below, never more. This requires PayPal Vault/Reference
              Transactions to be available on the merchant account; if it isn&apos;t, enabling this
              will fail with a clear error.
            </p>
          </div>

          {error && (
            <div role="alert" className="rounded-md bg-ledger-green/10 p-3 text-xs text-ledger-green-900">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-md bg-confirmed p-3 text-xs font-medium text-ink">{notice}</div>
          )}

          <form onSubmit={handleEnable} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Maximum amount to auto-charge (USD)</span>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={maxAmountDollars}
                onChange={(e) => setMaxAmountDollars(e.target.value)}
                placeholder="50.00"
                className="w-full rounded-sm border-hairline border-ink/15 bg-white px-4 py-2.5 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-ink px-4 py-3 text-sm font-bold text-paper transition-transform hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? 'Update ceiling' : 'Enable AutoDefend'}
            </button>
          </form>

          {active && (
            <button
              onClick={handleDisable}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-sm border-hairline border-ink/15 px-4 py-2.5 text-xs font-medium text-ink-60 transition-colors hover:bg-paper hover:text-ink disabled:opacity-50"
            >
              Turn off AutoDefend
            </button>
          )}
        </div>
      )}
    </main>
  );
}
