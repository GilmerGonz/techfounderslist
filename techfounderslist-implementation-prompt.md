# MASTER IMPLEMENTATION PROMPT
### Project: "The Tech Founders List" (Techfounderslist) — Private Index for Tech Startups, High-Ticket Positioning

Copy everything below this line and send it to your AI coding assistant (Claude Code, Cursor, etc.) as the system/project prompt.

---

## ROLE

You are a senior full-stack engineer building a production-grade web application from scratch. Follow this specification exactly. Ask clarifying questions only if something is truly ambiguous — otherwise make reasonable engineering decisions consistent with the stack below and document them in code comments.

---

## 1. PRODUCT OVERVIEW

Build **Techfounderslist**, publicly branded as **"The Tech Founders List"** — a live index where tech startups hold index positions claimed by outbidding the current holder. The underlying mechanic is a pay-to-rank auction, identical in logic to earlier "leaderboard" products, but the product must be positioned and copywritten as a **serious, high-ticket index for tech founders and investors** — closer to a private research index than a viral meme site. Reference the attached brand guide and design prompt for the full visual system (Paper/Ink/Ledger-green/Brass palette, Fraunces/IBM Plex Sans/IBM Plex Mono typography, understated "Index Ticker" component).

**Core mechanic (unchanged from prior spec, reframed in copy only):**
- A public index displays companies ordered strictly by how much capital was committed to hold each position — not by merit, revenue, or votes.
- To claim position #1 (or any position), a user must commit **at least $1 more** than the amount currently held at that position.
- Paying instantly displaces the current holder; everyone below shifts down one spot.
- Position price is public and live-updating.
- **Positioning note for all product copy generated during implementation:** never describe this internally or in UI copy as a "bidding war," "ranking game," or anything gamified — use "claim a position," "committed capital," "the index." This is a deliberate, brand-mandated language constraint, not a suggestion.

---

## 2. NON-NEGOTIABLE CORE RULES

1. Index state must NEVER be updated from the client. Only a confirmed, server-verified payment (via payment provider webhook) can change a position.
2. All position-claim changes must be atomic (DB transaction with row locking) to prevent race conditions when two users try to claim the same position simultaneously.
3. Every claim is an immutable historical record (never overwritten or deleted) — this powers the position price-history chart (a serious line chart, not a viral "price went from $1 to $10,000" callout — tone this down in copy per the brand guide).
4. The minimum increment logic must be centralized in one server-side function, never duplicated in the frontend.
5. All monetary amounts stored and computed in integer cents — never floats.

---

## 3. DIFFERENTIATORS (must be implemented)

| Feature | Description | Copy framing |
|---|---|---|
| Multiple categories | Separate indices per sector (AI, SaaS, Fintech, Infra, Consumer) | "Indices," not "leaderboards" |
| Enriched company profiles | Logo, description, optional real metrics (users, ARR) shown alongside position | Presented as plain labeled data pairs, not colorful badges — per design spec |
| Position-holding history | Track how long a company has held a position; historical index of longest-held positions | "Holding since [date]," never "Reigning Champion" — retire all game-show language |
| Auto-defend subscription | Optional Stripe subscription that automatically re-commits capital up to a user-defined max to retain a position when outranked | Framed as "position defense," a serious portfolio-management feature, not an "auto-bid" gimmick |
| Historical price chart | Plain line chart per position (no filled area, no bright colors) showing capital committed over time | Presented neutrally, not as a viral screenshot bait callout |
| Activity log | Chronological, timestamped log of position changes across all indices | Styled and worded like an audit trail/transaction log, not a social "activity feed" |
| Fraud protections | Rate limiting, Stripe Radar, email + company verification, configurable minimum increment | Company verification is stricter than the original spec — see Section 9 |

---

## 4. TECH STACK (use exactly this unless a library is deprecated/unavailable)

**Frontend**
- Next.js 14+ (App Router), TypeScript strict mode
- Tailwind CSS + shadcn/ui components, customized to the brand tokens (4/6/8px radii, Paper/Ink/Ledger-green/Brass/Slate palette — see brand guide)
- Framer Motion, used minimally per the design prompt's restrained motion philosophy (index reflow only, no celebratory animation)
- next-intl for i18n

**Backend**
- Next.js Route Handlers for API (monolithic to start)
- PostgreSQL (via Neon or Supabase — must support serverless connection pooling)
- Prisma ORM, EXCEPT for the critical position-claim transaction, which must use raw SQL with explicit `SELECT ... FOR UPDATE` row locking
- Redis (Upstash) for: caching current index state, rate limiting, pub/sub for real-time events

**Real-time**
- Pusher or Ably (managed WebSockets)

**Payments**
- Stripe (Payment Intents + Checkout for one-time claims, Subscriptions for auto-defend)
- Stripe Radar enabled
- Stripe Webhooks as the ONLY trigger for index state changes

**Infra**
- Vercel (frontend + API routes)
- Cloudflare in front of Vercel (CDN, DDoS protection, cache rules)
- Sentry for error monitoring
- Resend or Postmark for transactional emails, written in the restrained brand voice (no exclamation points, no "You've been outbid!" — use "Your position has been claimed by another company.")

---

## 5. DATABASE SCHEMA

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- 'ai', 'saas', 'fintech', 'infra', 'consumer'
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  owner_email TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  company_verified BOOLEAN DEFAULT false, -- stricter than prior spec, see Section 9
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE company_translations (
  company_id UUID REFERENCES companies(id),
  locale TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY (company_id, locale)
);

CREATE TABLE position_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  category_id UUID REFERENCES categories(id),
  amount_cents INTEGER NOT NULL,
  position INTEGER NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending | confirmed | failed | refunded
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE current_index (
  category_id UUID REFERENCES categories(id),
  position INTEGER,
  company_id UUID REFERENCES companies(id),
  current_amount_cents INTEGER,
  held_since TIMESTAMPTZ,
  PRIMARY KEY (category_id, position)
);

CREATE TABLE position_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  category_id UUID REFERENCES categories(id),
  position INTEGER,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER
);

CREATE TABLE auto_defend_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  category_id UUID REFERENCES categories(id),
  position INTEGER,
  max_amount_cents INTEGER NOT NULL,
  stripe_subscription_id TEXT,
  active BOOLEAN DEFAULT true
);
```

---

## 6. CORE LOGIC — ATOMIC POSITION CLAIM

Same transactional pattern as prior versions of this product; only naming changed (`claimPosition` → conceptually "commit capital to a position"). Implement exactly:

```typescript
async function claimPosition(
  companyId: string,
  categoryId: string,
  position: number,
  amountCents: number
) {
  return await db.$transaction(async (tx) => {
    const current = await tx.$queryRaw`
      SELECT * FROM current_index
      WHERE category_id = ${categoryId} AND position = ${position}
      FOR UPDATE
    `;

    const minRequired = current?.[0]
      ? current[0].current_amount_cents + 100
      : 100;

    if (amountCents < minRequired) {
      throw new InsufficientAmountError(minRequired);
    }

    if (current?.[0]) {
      await tx.position_history.updateMany({
        where: { company_id: current[0].company_id, ended_at: null },
        data: { ended_at: new Date() },
      });
    }

    await tx.$executeRaw`
      UPDATE current_index SET position = position + 1
      WHERE category_id = ${categoryId} AND position >= ${position}
    `;

    await tx.current_index.upsert({
      where: { category_id_position: { category_id: categoryId, position } },
      create: { category_id: categoryId, position, company_id: companyId, current_amount_cents: amountCents, held_since: new Date() },
      update: { company_id: companyId, current_amount_cents: amountCents, held_since: new Date() },
    });

    await tx.position_history.create({
      data: { company_id: companyId, category_id: categoryId, position, started_at: new Date() },
    });

    return { success: true, position };
  });
}
```

**Payment flow (mandatory order of operations):**
1. Client requests current minimum amount for a position (server-computed, never trust client-sent price).
2. Server creates a Stripe Payment Intent for that exact amount.
3. Client completes payment via Stripe Elements/Checkout.
4. Stripe sends `payment_intent.succeeded` webhook.
5. Webhook handler verifies signature, then calls `claimPosition()`.
6. On success, publish event to Redis pub/sub → Pusher broadcasts to all connected clients.
7. Send confirmation email to new holder and a plainly-worded "your position was claimed by another company" email to the previous holder — no gamified language.

---

## 7. INTERNATIONALIZATION (i18n)

Unchanged from prior spec: `next-intl`, locales `en` (default), `es`, `zh`, `de`, `ar`, `it`, `app/[locale]/...` route structure from day one, full RTL requirements for Arabic (logical Tailwind properties, mirrored icons, verified Framer Motion X-axis inversion). One addition specific to this brand: translated UI copy must preserve the restrained, non-gamified tone in every locale — flag this explicitly to translators/AI-translation tools so "claim position" isn't rendered as an exclamatory or game-like phrase in other languages.

---

## 8. REAL-TIME SYSTEM

Unchanged mechanically from prior spec (Redis pub/sub → Pusher channel per category, client-side reflow animation, 5s polling fallback). Per the design prompt, the client-side reflow animation must be a slow, deliberate 220ms ease with no color flash or celebratory effect — this is a brand-mandated change from a prior, more celebratory animation spec.

---

## 9. ANTI-FRAUD, VERIFICATION & RATE LIMITING

Stricter than the original leaderboard spec, consistent with high-ticket positioning:
- Redis-backed rate limiting: max N claim attempts per IP/email per minute.
- **Company verification (new requirement for this brand):** beyond email verification, require a company domain-match check (owner email domain matches the submitted company URL's domain) before a listing goes live — this prevents low-effort/spam listings that would undercut the "serious index" positioning.
- Stripe Radar enabled; reject/flag payment intents above a configurable risk_score threshold.
- Configurable minimum increment (flat or percentage) per category.
- Clear, plainly-worded refund policy displayed in the claim UI, not buried in ToS.

---

## 10. API ENDPOINTS

```
GET    /api/[locale]/categories
GET    /api/[locale]/index/:categorySlug
GET    /api/[locale]/index/:categorySlug/history
POST   /api/[locale]/companies                               # submit new company (pending verification)
POST   /api/[locale]/positions/quote                          # server computes current minimum for a position
POST   /api/[locale]/positions/checkout                       # creates Stripe Payment Intent
POST   /api/webhooks/stripe                                   # payment confirmation → claimPosition()
GET    /api/[locale]/companies/:id/og-card                    # dynamic share image, restrained/editorial style
POST   /api/[locale]/auto-defend                                # create/manage defend subscription
GET    /api/[locale]/index/longest-held                        # historical index of longest-held positions
```

---

## 11. NON-FUNCTIONAL REQUIREMENTS

Unchanged from prior spec: TypeScript strict mode, integer-cent monetary values, Cloudflare cache rules on public index GET endpoints, Sentry monitoring, environment-based config, integration tests specifically covering concurrent simultaneous claim attempts on the same position.

---

## 12. DELIVERY ROADMAP

**Phase 1 — MVP**
- `[locale]` routing scaffolded, `en.json` populated
- Single category, basic index page applying the full brand system (Paper/Ink/Ledger-green/Brass, Fraunces/IBM Plex Sans/IBM Plex Mono), Stripe Checkout (one-time claims only)
- Polling-based updates
- Company domain-verification check implemented from day one (not deferred — it's core to the positioning, unlike the original spec where fraud protection was a later-phase concern)
- Deploy to Vercel + Neon/Supabase

**Phase 2 — Real-time**
- Pusher integration
- Restrained OG share cards
- Activity log

**Phase 3 — Differentiators**
- Multiple categories
- Auto-defend subscriptions
- Position-history tracking + historical "longest-held" index

**Phase 4 — Full i18n rollout**
- `es`, `de`, `it` → `zh` → `ar` (RTL last, per prior sequencing logic)

**Phase 5 — Hardening**
- Cache tuning, concurrency load testing, fraud/verification rule tuning

---

## 13. WHAT TO DELIVER FIRST

Start with Phase 1 only, including the company domain-verification requirement (do not defer this — unlike the original looser leaderboard spec, unverified/spam listings directly undermine this product's premium positioning). Provide:
1. Full project scaffold with folder structure
2. Prisma schema file
3. The `claimPosition` transaction with tests for concurrent claims
4. Stripe webhook handler
5. Basic index page UI applying the full brand system, `en` locale, end-to-end

Do not build Phase 2+ features until Phase 1 is confirmed working, and do not let any UI copy, animation, or component drift back toward the gamified "leaderboard" tone this brand explicitly moves away from.
