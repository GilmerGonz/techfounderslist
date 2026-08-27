'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';

interface SubmitCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Array<{ id: string; slug: string; name: string }>;
  locale: string;
  t: (key: string, values?: any) => string;
}

/**
 * Single-column, generously-spaced form (max-width 560px) — the one screen
 * where centering is correct. Category select mirrors the header pill tabs.
 */
export function SubmitCompanyModal({
  isOpen,
  onClose,
  categories,
  locale,
  t,
}: SubmitCompanyModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [billingCountry, setBillingCountry] = useState('');
  const [billingTaxId, setBillingTaxId] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Default the category once the list loads (categories arrive after mount,
  // so the initial useState value is often empty).
  React.useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/${locale}/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          name,
          url,
          logoUrl: logoUrl || undefined,
          description: description || undefined,
          ownerEmail,
          billingCountry: billingCountry || undefined,
          billingTaxId: billingTaxId || undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to list company');

      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1400);
    } catch (err: any) {
      setLoading(false);
      setError(err.message);
    }
  };

  const inputClass =
    'w-full rounded-sm border-hairline border-ink/15 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-30';

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
            aria-labelledby="submit-modal-title"
            className="relative w-full max-w-[560px] rounded-lg border-hairline border-ink/10 bg-white p-6 text-ink sm:p-9"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute end-5 top-5 text-ink-30 transition-colors hover:text-ink"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>

            <div className="border-b border-hairline border-ink/10 pb-4">
              <h3 id="submit-modal-title" className="font-display text-xl font-bold">{t('submit.title')}</h3>
              <p className="mt-1 text-xs text-ink-60">{t('submit.subtitle')}</p>
            </div>

            {error && (
              <div role="alert" className="mt-4 rounded-md bg-ledger-green/10 p-3 text-xs text-ledger-green-900">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-4 rounded-md bg-confirmed p-3 text-xs font-medium text-ink">
                {t('submit.success')}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Category as pill tabs — same pattern as the header */}
              <div>
                <span className="mb-2 block text-xs font-semibold">{t('submit.category')}</span>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('submit.category')}>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={categoryId === c.id}
                      onClick={() => setCategoryId(c.id)}
                      className={
                        categoryId === c.id
                          ? 'rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper'
                          : 'rounded-full px-3.5 py-1.5 text-xs text-ink-60 hover:text-ink'
                      }
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold">{t('claimModal.projectName')} *</span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('claimModal.projectNamePlaceholder')}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold">{t('claimModal.projectUrl')} *</span>
                  <input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className={inputClass}
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
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold">{t('claimModal.logoUrl')}</span>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://.../logo.png"
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold">{t('claimModal.projectDescription')}</span>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('claimModal.descriptionPlaceholder')}
                  className={inputClass}
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold">{t('claimModal.billingCountry')}</span>
                  <input
                    type="text"
                    value={billingCountry}
                    onChange={(e) => setBillingCountry(e.target.value)}
                    placeholder={t('claimModal.billingCountryPlaceholder')}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold">{t('claimModal.billingTaxId')}</span>
                  <input
                    type="text"
                    value={billingTaxId}
                    onChange={(e) => setBillingTaxId(e.target.value)}
                    placeholder={t('claimModal.billingTaxIdPlaceholder')}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 rounded-sm bg-ledger-green px-5 py-2.5 text-sm font-bold text-paper transition-transform hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('submit.action')}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
