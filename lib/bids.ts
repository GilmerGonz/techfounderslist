import { prisma } from './db';
import crypto from 'crypto';
import { chargeVaultedPayPal, refundPayPalCapture } from './paypal';

// ── Test seam ────────────────────────────────────────────────────────────────
// Lets the test suite stub PayPal's network calls so AutoDefend can be exercised
// without real charges. Defaults to the production implementations; this is a
// no-op at runtime (nothing overrides the seam outside of tests).
let _chargeVaultedPayPal = chargeVaultedPayPal;
let _refundPayPalCapture = refundPayPalCapture;
export function __setPaypalMocks(opts: {
  chargeVaultedPayPal?: typeof chargeVaultedPayPal;
  refundPayPalCapture?: typeof refundPayPalCapture;
}): void {
  if (opts.chargeVaultedPayPal) _chargeVaultedPayPal = opts.chargeVaultedPayPal;
  if (opts.refundPayPalCapture) _refundPayPalCapture = opts.refundPayPalCapture;
}

export class InsufficientAmountError extends Error {
  minRequiredCents: number;
  constructor(minRequiredCents: number) {
    super(`The minimum to claim this position is ${minRequiredCents} cents.`);
    this.name = 'InsufficientAmountError';
    this.minRequiredCents = minRequiredCents;
  }
}

/**
 * Claim economics — single source of truth (spec §2 rule 4).
 * Never duplicate these numbers elsewhere; import from here server-side.
 */
export const MIN_BID_CENTS = 100; // floor to claim an empty spot: $1.00
export const MIN_INCREMENT_CENTS = 100; // minimum raise over the held amount: $1.00

// Hard ceiling on rankable positions. Bounds the cost of the position-shift
// loop in claimPosition() (which touches O(positions >= target) rows per
// claim) and rejects nonsensical/abusive inputs (0, negative, huge numbers).
export const MAX_POSITION = 500;

export function getMinRequiredCents(currentAmountCents?: number | null): number {
  return currentAmountCents && currentAmountCents > 0
    ? currentAmountCents + MIN_INCREMENT_CENTS
    : MIN_BID_CENTS;
}

export function isValidPosition(position: unknown): position is number {
  return (
    typeof position === 'number' &&
    Number.isInteger(position) &&
    position >= 1 &&
    position <= MAX_POSITION
  );
}

// ═══════════════════════════════════════════════════════════
// URL Validation (SSRF / XSS prevention)
// ═══════════════════════════════════════════════════════════

const BLOCKED_URL_PATTERNS = [
  /^javascript:/i,
  /^data:/i,
  /^vbscript:/i,
  /^file:/i,
  /169\.254\.169\.254/, // AWS/GCP metadata
  /metadata\.google\.internal/,
  /100\.100\.100\.200/,
];

function validateUrl(url: string, fieldName: string): void {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`${fieldName} must use http or https`);
    }
    for (const pattern of BLOCKED_URL_PATTERNS) {
      if (pattern.test(url)) {
        throw new Error(`${fieldName} contains a blocked pattern`);
      }
    }
  } catch (err: any) {
    if (err.message.includes('Invalid URL')) {
      throw new Error(`${fieldName} is not a valid URL`);
    }
    throw err;
  }
}

/**
 * Extract the registrable domain (eTLD+1) from a hostname.
 * "www.acme.com" -> "acme.com"; "api.acme.co.uk" -> "acme.co.uk".
 * Used for the company-domain-match anti-fraud check (TFL spec §9).
 */
function registrableDomain(hostname: string): string {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  const parts = h.split('.');
  if (parts.length <= 2) return h;
  return parts.slice(-2).join('.');
}

/**
 * Anti-fraud: the owner's email domain must match the submitted company URL's
 * domain. Prevents low-effort/spam listings that would undercut the "serious
 * index" positioning. Disabled when ALLOW_DOMAIN_MISMATCH=1 (dev/demo only).
 */
function assertCompanyDomainMatch(ownerEmail: string, url: string): void {
  if (process.env.ALLOW_DOMAIN_MISMATCH === '1') return;
  try {
    const emailDomain = registrableDomain(ownerEmail.split('@')[1] || '');
    const urlDomain = registrableDomain(new URL(url).hostname);
    const matches =
      emailDomain === urlDomain || emailDomain.endsWith(`.${urlDomain}`);
    if (!matches) {
      throw new Error(
        'The owner email domain must match the company URL domain (e.g. you@acme.com for https://acme.com).'
      );
    }
  } catch (err: any) {
    if (err.message.includes('must match')) throw err;
    throw new Error(`Could not verify company domain: ${err.message}`);
  }
}

/** Returns true when the owner email domain matches the company URL domain. */
function domainsMatch(ownerEmail: string, url: string): boolean {
  try {
    const emailDomain = registrableDomain(ownerEmail.split('@')[1] || '');
    const urlDomain = registrableDomain(new URL(url).hostname);
    return emailDomain === urlDomain || emailDomain.endsWith(`.${urlDomain}`);
  } catch {
    return false;
  }
}

/**
 * Localize company fields (name/description/url) for the requested locale,
 * falling back to the base values when no translation exists. Translations are
 * an optional per-locale override stored on the company.
 */
function localizeCompany<T extends { name: string; description?: string | null; url: string }>(
  company: T,
  locale?: string
): T {
  if (!locale) return company;
  const translations = (company as { translations?: Record<string, CompanyTranslation> }).translations;
  const t = translations?.[locale];
  if (!t) return company;
  return {
    ...company,
    name: t.name ?? company.name,
    description: t.description ?? company.description,
    url: t.url ?? company.url,
  };
}

// ═══════════════════════════════════════════════════════════
// Ownership token (HMAC) — prevents claiming a position for an
// arbitrary existing company. The token is signed server-side at
// company creation and must be presented on checkout. Unforgeable.
// ═══════════════════════════════════════════════════════════

const CLAIM_SECRET =
  process.env.POSITION_CLAIM_SECRET || 'dev-insecure-claim-secret-change-me';

if (process.env.NODE_ENV === 'production' && !process.env.POSITION_CLAIM_SECRET) {
  console.error('POSITION_CLAIM_SECRET is not set — ownership tokens are insecure in production.');
}

export function signCompanyId(companyId: string): string {
  const sig = crypto.createHmac('sha256', CLAIM_SECRET).update(companyId).digest('hex');
  return `${companyId}:${sig}`;
}

export function verifyCompanyToken(companyId: string, token?: string): boolean {
  if (!token) return false;
  const [id, sig] = token.split(':');
  if (id !== companyId || !sig) return false;
  const expected = crypto.createHmac('sha256', CLAIM_SECRET).update(companyId).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ═══════════════════════════════════════════════════════════
// In-Memory Fallback State for Local Demo / Concurrency Testing
// ═══════════════════════════════════════════════════════════

type IndexItem = {
  categoryId: string;
  position: number;
  companyId: string;
  currentAmountCents: number;
  heldSince: Date;
};

type PositionHistoryItem = {
  id: string;
  companyId: string;
  categoryId: string;
  position: number;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
};

type ClaimItem = {
  id: string;
  companyId: string;
  categoryId: string;
  amountCents: number;
  position: number;
  paymentRefId: string;
  paymentProvider: string;
  status: string;
  createdAt: Date;
};

type CompanyTranslation = { name?: string; description?: string; url?: string };

type CompanyItem = {
  id: string;
  categoryId: string;
  name: string;
  url: string;
  logoUrl?: string;
  description?: string;
  ownerEmail: string;
  emailVerified: boolean;
  companyVerified: boolean;
  createdAt: Date;
  translations?: Record<string, CompanyTranslation>;
};

type MockStore = {
  categories: { id: string; slug: string; name: string; createdAt: Date }[];
  companies: Map<string, CompanyItem>;
  currentIndex: Map<string, IndexItem>;
  positionHistory: PositionHistoryItem[];
  claims: ClaimItem[];
};

// Keep a single shared instance across Next.js dev route-module evaluations
// (each route handler can be compiled in its own module scope, which would
// otherwise give every route its own empty in-memory store).
const globalForStore = globalThis as unknown as { __tflMockStore?: MockStore };
const mockStore: MockStore =
  globalForStore.__tflMockStore ??
  (globalForStore.__tflMockStore = {
    categories: [
      { id: 'cat-saas', slug: 'saas', name: 'SaaS', createdAt: new Date() },
      { id: 'cat-ai', slug: 'ai', name: 'AI', createdAt: new Date() },
      { id: 'cat-fintech', slug: 'fintech', name: 'Fintech', createdAt: new Date() },
      { id: 'cat-infra', slug: 'infra', name: 'Infra', createdAt: new Date() },
      { id: 'cat-consumer', slug: 'consumer', name: 'Consumer', createdAt: new Date() },
    ],
    companies: new Map<string, CompanyItem>(),
    currentIndex: new Map<string, IndexItem>(),
    positionHistory: [] as PositionHistoryItem[],
    claims: [] as ClaimItem[],
  });

// Category level async mutex lock for thread safety in node event loop
const categoryLocks = new Map<string, Promise<void>>();

async function acquireCategoryLock(categoryId: string): Promise<() => void> {
  while (categoryLocks.has(categoryId)) {
    await categoryLocks.get(categoryId);
  }

  let releaseLock: () => void = () => {};
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  categoryLocks.set(categoryId, lockPromise);

  return () => {
    categoryLocks.delete(categoryId);
    releaseLock();
  };
}

// Per-captureId mutex — prevents the /capture endpoint and the PayPal webhook
// from both processing the same capture (double-claim race, audit §2).
const captureLocks = new Map<string, Promise<void>>();

async function acquireCaptureLock(captureId: string): Promise<() => void> {
  while (captureLocks.has(captureId)) {
    await captureLocks.get(captureId);
  }
  let releaseLock: () => void = () => {};
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  captureLocks.set(captureId, lockPromise);
  return () => {
    captureLocks.delete(captureId);
    releaseLock();
  };
}

export async function withCaptureLock<T>(
  captureId: string,
  fn: () => Promise<T>
): Promise<T> {
  const release = await acquireCaptureLock(captureId);
  try {
    return await fn();
  } finally {
    release();
  }
}

function hasDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * Server-computed minimum amount for a given category & position.
 */
export async function getMinRequiredBid(categoryId: string, position: number): Promise<{
  currentAmountCents: number;
  minRequiredCents: number;
  currentHolder?: CompanyItem;
}> {
  if (hasDatabase()) {
    // No mock fallback here: a DB read failure while a real database is
    // configured must surface as an error, not silently quote against a
    // stale/empty in-memory store (which could let a claim underpay).
    const current = await prisma.currentIndex.findUnique({
      where: { category_id_position: { categoryId, position } },
      include: { company: true },
    });

    if (!current) {
      return { currentAmountCents: 0, minRequiredCents: MIN_BID_CENTS };
    }

    return {
      currentAmountCents: current.currentAmountCents,
      minRequiredCents: getMinRequiredCents(current.currentAmountCents),
      currentHolder: current.company as unknown as CompanyItem,
    };
  }

  const key = `${categoryId}:${position}`;
  const current = mockStore.currentIndex.get(key);
  if (!current) {
    return { currentAmountCents: 0, minRequiredCents: MIN_BID_CENTS };
  }

  const company = mockStore.companies.get(current.companyId);
  return {
    currentAmountCents: current.currentAmountCents,
    minRequiredCents: getMinRequiredCents(current.currentAmountCents),
    currentHolder: company,
  };
}

/**
 * ATOMIC POSITION CLAIM
 *
 * 1. Index state MUST be updated server-side in an atomic transaction.
 * 2. Minimum increment (+$1.00 = +100 cents).
 * 3. Close position history for displaced holder.
 * 4. Shift positions >= target down by 1.
 * 5. Insert/upsert new position holder.
 * 6. Record new position history entry.
 */
export async function claimPosition(
  companyId: string,
  categoryId: string,
  position: number,
  amountCents: number
): Promise<{ success: boolean; position: number; displacedCompanyId?: string }> {
  if (!isValidPosition(position)) {
    throw new Error(`position must be an integer between 1 and ${MAX_POSITION}`);
  }

  // Positions must always change hands over a whole dollar, never a few
  // cents — reject anything that isn't a positive multiple of 100 cents
  // before it ever reaches the minimum-increment check below.
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents % 100 !== 0) {
    throw new Error('amountCents must be a positive whole-dollar amount (a multiple of 100 cents).');
  }

  if (hasDatabase()) {
    // Real money may already have been captured by the time this runs
    // (capture/webhook call this after a successful PayPal capture). A
    // transaction failure here must propagate as a hard error — never fall
    // through to the in-memory mock store, which would silently record the
    // claim somewhere the paying customer (and every other server instance)
    // can never see again.
    return await prisma.$transaction(async (tx) => {
        const current: any[] = await tx.$queryRaw`
          SELECT * FROM current_index
          WHERE category_id = ${categoryId}::uuid AND position = ${position}
          FOR UPDATE
        `;

        const minRequired = getMinRequiredCents(current?.[0]?.current_amount_cents);

        if (amountCents < minRequired) {
          throw new InsufficientAmountError(minRequired);
        }

        let displacedCompanyId: string | undefined;

        if (current?.[0]) {
          displacedCompanyId = current[0].company_id;
          await tx.positionHistory.updateMany({
            where: { companyId: current[0].company_id, endedAt: null },
            data: {
              endedAt: new Date(),
              durationSeconds: Math.floor(
                (Date.now() - new Date(current[0].held_since).getTime()) / 1000
              ),
            },
          });
        }

        const maxPosResult: any[] = await tx.$queryRaw`
          SELECT COALESCE(MAX(position), 0) as max_pos FROM current_index
          WHERE category_id = ${categoryId}::uuid AND position >= ${position}
        `;
        const maxPos = maxPosResult?.[0]?.max_pos ?? 0;

        if (maxPos >= position) {
          for (let p = maxPos; p >= position; p--) {
            await tx.$executeRaw`
              UPDATE current_index SET position = position + 1
              WHERE category_id = ${categoryId}::uuid AND position = ${p}
            `;
          }
        }

        await tx.currentIndex.upsert({
          where: { category_id_position: { categoryId, position } },
          create: {
            categoryId,
            position,
            companyId,
            currentAmountCents: amountCents,
            heldSince: new Date(),
          },
          update: {
            companyId,
            currentAmountCents: amountCents,
            heldSince: new Date(),
          },
        });

        await tx.positionHistory.create({
          data: {
            companyId,
            categoryId,
            position,
            startedAt: new Date(),
          },
        });

        return { success: true, position, displacedCompanyId };
      });
  }

  // In-memory path — only reached when no DATABASE_URL is configured
  // (local/demo mode). Never used as a post-hoc fallback for a real DB.
  const releaseLock = await acquireCategoryLock(categoryId);

  try {
    const key = `${categoryId}:${position}`;
    const current = mockStore.currentIndex.get(key);

    const minRequired = getMinRequiredCents(current?.currentAmountCents);

    if (amountCents < minRequired) {
      throw new InsufficientAmountError(minRequired);
    }

    const displacedCompanyId = current?.companyId;

    if (displacedCompanyId) {
      const active = mockStore.positionHistory.find(
        (r) => r.companyId === displacedCompanyId && r.endedAt === null
      );
      if (active) {
        active.endedAt = new Date();
        active.durationSeconds = Math.floor(
          (active.endedAt.getTime() - active.startedAt.getTime()) / 1000
        );
      }
    }

    const indicesForCategory = Array.from(mockStore.currentIndex.values())
      .filter((r) => r.categoryId === categoryId)
      .sort((a, b) => b.position - a.position);

    for (const item of indicesForCategory) {
      if (item.position >= position) {
        mockStore.currentIndex.delete(`${categoryId}:${item.position}`);
        item.position += 1;
        mockStore.currentIndex.set(`${categoryId}:${item.position}`, item);
      }
    }

    mockStore.currentIndex.set(key, {
      categoryId,
      position,
      companyId,
      currentAmountCents: amountCents,
      heldSince: new Date(),
    });

    mockStore.positionHistory.push({
      id: `pos-${Date.now()}-${Math.random()}`,
      companyId,
      categoryId,
      position,
      startedAt: new Date(),
      endedAt: null,
      durationSeconds: null,
    });

    return { success: true, position, displacedCompanyId };
  } finally {
    releaseLock();
  }
}

/**
 * Get the current index for a category.
 */
export async function getIndex(categorySlug: string, locale?: string) {
  if (hasDatabase()) {
    const category = await prisma.category.findUnique({
      where: { slug: categorySlug },
    });

    if (!category) {
      const fallback = await prisma.category.findFirst();
      if (!fallback) {
        return { category: null, rankings: [] };
      }
      const rankings = await prisma.currentIndex.findMany({
        where: { categoryId: fallback.id },
        include: { company: true },
        orderBy: { position: 'asc' },
      });
      return {
        category: fallback,
        rankings: rankings.map((r) => ({
          position: r.position,
          currentAmountCents: r.currentAmountCents,
          heldSince: r.heldSince,
          company: localizeCompany(r.company, locale),
        })),
      };
    }

    const rankings = await prisma.currentIndex.findMany({
      where: { categoryId: category.id },
      include: { company: true },
      orderBy: { position: 'asc' },
    });

    return {
      category,
      rankings: rankings.map((r) => {
        const loc = localizeCompany(r.company, locale);
        return {
          position: r.position,
          currentAmountCents: r.currentAmountCents,
          heldSince: r.heldSince,
          company: {
            id: loc.id,
            name: loc.name,
            url: loc.url,
            logoUrl: loc.logoUrl,
            description: loc.description,
            verified: r.company.companyVerified,
          },
        };
      }),
    };
  }

  const category =
    mockStore.categories.find((c) => c.slug === categorySlug) || mockStore.categories[0];

  const rankings = Array.from(mockStore.currentIndex.values())
    .filter((r) => r.categoryId === category.id)
    .sort((a, b) => a.position - b.position)
    .map((r) => {
      const company = mockStore.companies.get(r.companyId);
      const loc = company ? localizeCompany(company, locale) : null;
      return {
        position: r.position,
        currentAmountCents: r.currentAmountCents,
        heldSince: r.heldSince,
        company: loc
          ? {
              id: loc.id,
              name: loc.name,
              url: loc.url,
              logoUrl: loc.logoUrl,
              description: loc.description,
              verified: loc.companyVerified,
            }
          : {
              id: r.companyId,
              name: 'Anonymous Company',
              url: 'https://example.com',
              verified: false,
            },
      };
    });

  return { category, rankings };
}

/**
 * Get categories list.
 */
export async function getCategories() {
  if (hasDatabase()) {
    return await prisma.category.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }
  return mockStore.categories;
}

/**
 * Register a new company. Returns the company plus a signed ownership token
 * that must be presented on checkout (anti-claim-forgery, audit §1).
 */
export async function createCompany(data: {
  categoryId: string;
  name: string;
  url: string;
  logoUrl?: string;
  description?: string;
  ownerEmail: string;
  translations?: Record<string, CompanyTranslation>;
  // Optional, self-reported accounting fields — see schema.prisma comment.
  billingCountry?: string;
  billingTaxId?: string;
}): Promise<CompanyItem & { token: string }> {
  validateUrl(data.url, 'url');
  if (data.logoUrl) {
    validateUrl(data.logoUrl, 'logoUrl');
  }

  const verified = domainsMatch(data.ownerEmail, data.url);
  assertCompanyDomainMatch(data.ownerEmail, data.url);

  const sanitizedName = data.name.replace(/<[^>]*>/g, '').trim().slice(0, 100);
  const sanitizedDescription = data.description
    ? data.description.replace(/<[^>]*>/g, '').trim().slice(0, 500)
    : undefined;
  const sanitizedBillingCountry = data.billingCountry
    ? data.billingCountry.replace(/<[^>]*>/g, '').trim().slice(0, 100)
    : undefined;
  const sanitizedBillingTaxId = data.billingTaxId
    ? data.billingTaxId.replace(/<[^>]*>/g, '').trim().slice(0, 50)
    : undefined;

  if (!sanitizedName) {
    throw new Error('Company name is required');
  }

  if (hasDatabase()) {
    // No mock fallback: a company created in memory while a real DB is
    // configured would still pass verifyCompanyToken() later (the HMAC only
    // signs the id), but claimPosition()'s FK insert against the real
    // `companies` table would fail with a confusing foreign-key error instead
    // of a clear "try again" — surface the real DB error immediately.
    const company = await prisma.company.create({
      data: {
        categoryId: data.categoryId,
        name: sanitizedName,
        url: data.url,
        logoUrl:
          data.logoUrl ||
          `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(sanitizedName)}`,
        description: sanitizedDescription,
        ownerEmail: data.ownerEmail,
        emailVerified: false,
        companyVerified: verified,
        billingCountry: sanitizedBillingCountry,
        billingTaxId: sanitizedBillingTaxId,
      },
    });
    return { ...(company as unknown as CompanyItem), token: signCompanyId(company.id) };
  }

  const id = `comp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const company: CompanyItem = {
    id,
    categoryId: data.categoryId,
    name: sanitizedName,
    url: data.url,
    logoUrl:
      data.logoUrl ||
      `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(sanitizedName)}`,
    description: sanitizedDescription,
    ownerEmail: data.ownerEmail,
    emailVerified: false,
    companyVerified: verified,
    translations: data.translations,
    createdAt: new Date(),
  };

  mockStore.companies.set(id, company);
  return { ...company, token: signCompanyId(id) };
}

/**
 * Record a new position claim (immutable history entry).
 */
export async function recordClaim(data: {
  companyId: string;
  categoryId: string;
  amountCents: number;
  position: number;
  paymentRefId: string;
  paymentProvider: string;
  status?: string;
}) {
  const claimStatus = data.status || 'confirmed';

  if (hasDatabase()) {
    // This is the immutable payment audit trail — never silently swap it for
    // an in-memory record after a real capture/refund has happened.
    return await prisma.positionClaim.create({
      data: {
        companyId: data.companyId,
        categoryId: data.categoryId,
        amountCents: data.amountCents,
        position: data.position,
        paymentRefId: data.paymentRefId,
        paymentProvider: data.paymentProvider,
        status: claimStatus,
      },
    });
  }

  const claim: ClaimItem = {
    id: `claim-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    companyId: data.companyId,
    categoryId: data.categoryId,
    amountCents: data.amountCents,
    position: data.position,
    paymentRefId: data.paymentRefId,
    paymentProvider: data.paymentProvider,
    status: claimStatus,
    createdAt: new Date(),
  };
  mockStore.claims.push(claim);
  return claim;
}

/**
 * Idempotency check — true if a claim with this payment reference exists.
 */
export async function hasClaimWithRef(paymentRefId: string): Promise<boolean> {
  if (hasDatabase()) {
    // This gates double-processing a PayPal capture (audit §2). Swallowing a
    // DB error here would make it look like "no claim yet" and let the
    // capture endpoint and the webhook double-claim the same payment.
    const existing = await prisma.positionClaim.findUnique({ where: { paymentRefId } });
    return existing !== null;
  }
  return mockStore.claims.some((c) => c.paymentRefId === paymentRefId);
}

/**
 * Chronological activity log of confirmed claims (audit-trail tone).
 */
export async function getRecentClaims(categorySlug?: string) {
  if (hasDatabase()) {
    const where: any = { status: 'confirmed' };
    if (categorySlug) {
      const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
      if (category) {
        where.categoryId = category.id;
      }
    }

    const claims = await prisma.positionClaim.findMany({
      where,
      include: {
        company: { select: { id: true, name: true, logoUrl: true, companyVerified: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return claims.map((claim) => ({
      id: claim.id,
      companyId: claim.companyId,
      categoryId: claim.categoryId,
      amountCents: claim.amountCents,
      position: claim.position,
      createdAt: claim.createdAt,
      company: claim.company
        ? { id: claim.company.id, name: claim.company.name, logoUrl: claim.company.logoUrl, verified: claim.company.companyVerified }
        : undefined,
    }));
  }

  const category = categorySlug
    ? mockStore.categories.find((c) => c.slug === categorySlug)
    : undefined;

  return mockStore.claims
    .filter((c) => c.status === 'confirmed' && (!category || c.categoryId === category.id))
    .slice(-10)
    .reverse()
    .map((c) => {
      const company = mockStore.companies.get(c.companyId);
      return {
        ...c,
        company: company
          ? { id: company.id, name: company.name, logoUrl: company.logoUrl, verified: company.companyVerified }
          : undefined,
      };
    });
}

/**
 * Historical index of longest-held positions (audit/reference table).
 */
export async function getLongestHeld(limit = 20) {
  if (hasDatabase()) {
    const history = await prisma.positionHistory.findMany({
      where: { endedAt: { not: null } },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { durationSeconds: 'desc' },
      take: limit,
    });
    return history.map((h) => ({
      id: h.id,
      companyId: h.companyId,
      companyName: h.company?.name ?? 'Unknown',
      position: h.position,
      durationSeconds: h.durationSeconds ?? 0,
      startedAt: h.startedAt,
      endedAt: h.endedAt,
    }));
  }

  return mockStore.positionHistory
    .filter((h) => h.endedAt !== null)
    .sort((a, b) => (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0))
    .slice(0, limit)
    .map((h) => {
      const company = mockStore.companies.get(h.companyId);
      return {
        id: h.id,
        companyId: h.companyId,
        companyName: company?.name ?? 'Unknown',
        position: h.position,
        durationSeconds: h.durationSeconds ?? 0,
        startedAt: h.startedAt,
        endedAt: h.endedAt,
      };
    });
}

/** Reset store for tests. */
export function _resetMockStore() {
  mockStore.currentIndex.clear();
  mockStore.positionHistory = [];
  mockStore.claims = [];
}

// ═══════════════════════════════════════════════════════════
// AutoDefend — PayPal-vault-backed auto-rebid on displacement
// (Stripe is unavailable to this merchant; PayPal has no plain recurring-
// charge API, so this uses PayPal Vault: a payment token captured during a
// real checkout — see createPayPalOrder's `vault` option — that can later be
// charged with the owner not present. Requires the merchant's PayPal
// account to have Vault/Reference Transactions enabled.)
// ═══════════════════════════════════════════════════════════

// Hard cap on auto-defend chain reactions from a single human-initiated
// claim (A auto-defends, displacing B who also auto-defends, displacing C,
// ...). Without this a bidding war between two AutoDefend subscribers could
// recurse indefinitely, charging both cards over and over.
const MAX_AUTODEFEND_CHAIN_DEPTH = 3;

/** Persists the PayPal Vault token captured from a real checkout, if any. */
export async function saveCompanyVaultId(companyId: string, vaultId: string): Promise<void> {
  if (!hasDatabase()) return; // AutoDefend is DB-only; no-op in demo mode.
  await prisma.company.update({
    where: { id: companyId },
    data: { paypalVaultId: vaultId },
  });
}

export class AutoDefendUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AutoDefendUnavailableError';
  }
}

/**
 * Enable (or update) AutoDefend for a position the caller has already proven
 * ownership of (verifyCompanyToken, checked by the route). Requires a vault
 * id already on file — i.e. at least one prior real checkout that PayPal
 * successfully vaulted.
 */
export async function subscribeAutoDefend(data: {
  companyId: string;
  categoryId: string;
  position: number;
  maxAmountCents: number;
}) {
  if (!hasDatabase()) {
    throw new AutoDefendUnavailableError('AutoDefend requires a configured database.');
  }
  if (!isValidPosition(data.position)) {
    throw new Error(`position must be an integer between 1 and ${MAX_POSITION}`);
  }
  if (!Number.isInteger(data.maxAmountCents) || data.maxAmountCents < MIN_BID_CENTS) {
    throw new Error(`maxAmountCents must be an integer >= ${MIN_BID_CENTS}`);
  }

  const company = await prisma.company.findUnique({ where: { id: data.companyId } });
  if (!company) throw new Error('Company not found.');
  if (!company.paypalVaultId) {
    throw new AutoDefendUnavailableError(
      'No saved PayPal payment method on file. Complete a real (non-demo) PayPal claim first — AutoDefend reuses that same payment method.'
    );
  }

  return prisma.autoDefendSubscription.upsert({
    where: {
      company_id_category_id_position: {
        companyId: data.companyId,
        categoryId: data.categoryId,
        position: data.position,
      },
    },
    create: {
      companyId: data.companyId,
      categoryId: data.categoryId,
      position: data.position,
      maxAmountCents: data.maxAmountCents,
      paypalVaultId: company.paypalVaultId,
      active: true,
    },
    update: {
      maxAmountCents: data.maxAmountCents,
      paypalVaultId: company.paypalVaultId,
      active: true,
    },
  });
}

export async function cancelAutoDefend(data: {
  companyId: string;
  categoryId: string;
  position: number;
}): Promise<void> {
  if (!hasDatabase()) return;
  await prisma.autoDefendSubscription.updateMany({
    where: { companyId: data.companyId, categoryId: data.categoryId, position: data.position },
    data: { active: false },
  });
}

export async function getAutoDefendStatus(data: {
  companyId: string;
  categoryId: string;
  position: number;
}) {
  if (!hasDatabase()) return null;
  return prisma.autoDefendSubscription.findUnique({
    where: {
      company_id_category_id_position: {
        companyId: data.companyId,
        categoryId: data.categoryId,
        position: data.position,
      },
    },
  });
}

/**
 * Called after a claim displaces a previous holder. If the displaced company
 * has an active AutoDefend subscription for that exact spot, attempts one
 * automatic re-claim on their behalf, charging their vaulted PayPal token up
 * to (never beyond) their configured ceiling.
 *
 * Failures here are swallowed (logged + the subscription is disabled on a
 * payment error) — this runs after the triggering claim has already been
 * confirmed for its own buyer, and must never turn their successful payment
 * into an error response.
 */
export async function triggerAutoDefend(
  categoryId: string,
  position: number,
  displacedCompanyId: string,
  depth: number = 0
): Promise<void> {
  if (!hasDatabase()) return;
  if (depth >= MAX_AUTODEFEND_CHAIN_DEPTH) {
    console.warn(
      `AutoDefend: chain depth limit (${MAX_AUTODEFEND_CHAIN_DEPTH}) reached for ${categoryId}:${position}, stopping.`
    );
    return;
  }

  const sub = await prisma.autoDefendSubscription.findUnique({
    where: {
      company_id_category_id_position: {
        companyId: displacedCompanyId,
        categoryId,
        position,
      },
    },
  });
  if (!sub || !sub.active) return;

  const quote = await getMinRequiredBid(categoryId, position);
  if (quote.minRequiredCents > sub.maxAmountCents) {
    console.warn(
      `AutoDefend: required ${quote.minRequiredCents} exceeds cap ${sub.maxAmountCents} for company ${displacedCompanyId} at ${categoryId}:${position}; skipping.`
    );
    return;
  }

  const meta = {
    companyId: displacedCompanyId,
    categoryId,
    position: position.toString(),
    amountCents: quote.minRequiredCents.toString(),
  };

  let captureId: string;
  try {
    const charge = await _chargeVaultedPayPal(sub.paypalVaultId, quote.minRequiredCents, 'USD', meta);
    captureId = charge.captureId;
  } catch (err: any) {
    console.error(`AutoDefend: charge failed for company ${displacedCompanyId}:`, err.message);
    // Disable rather than retry forever on a dead/declined/unsupported vault
    // token — the owner must re-enable it after fixing their payment method.
    await cancelAutoDefend({ companyId: displacedCompanyId, categoryId, position });
    return;
  }

  try {
    const result = await claimPosition(displacedCompanyId, categoryId, position, quote.minRequiredCents);
    await recordClaim({
      companyId: displacedCompanyId,
      categoryId,
      amountCents: quote.minRequiredCents,
      position,
      paymentRefId: captureId,
      paymentProvider: 'paypal-autodefend',
      status: 'confirmed',
    });

    if (result.displacedCompanyId) {
      await triggerAutoDefend(categoryId, position, result.displacedCompanyId, depth + 1);
    }
  } catch (err: any) {
    // Money was already charged but the reclaim failed (e.g. someone else
    // claimed the spot in between) — refund immediately, same as the manual
    // capture path does.
    console.error(`AutoDefend: reclaim failed after charge for company ${displacedCompanyId}:`, err.message);
    try {
      await _refundPayPalCapture(captureId, quote.minRequiredCents);
      await recordClaim({
        companyId: displacedCompanyId,
        categoryId,
        amountCents: quote.minRequiredCents,
        position,
        paymentRefId: captureId,
        paymentProvider: 'paypal-autodefend',
        status: 'refunded',
      });
    } catch (refundErr: any) {
      console.error('AutoDefend: refund-after-failed-reclaim also failed:', refundErr.message);
      await recordClaim({
        companyId: displacedCompanyId,
        categoryId,
        amountCents: quote.minRequiredCents,
        position,
        paymentRefId: captureId,
        paymentProvider: 'paypal-autodefend',
        status: 'failed_needs_refund',
      });
    }
  }
}
