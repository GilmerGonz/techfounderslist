# MASTER IMPLEMENTATION PROMPT
### Project: "RankBid" — Real-Time Pay-to-Rank Auction Platform (Outbit.lol-style, improved)

Copy everything below this line and send it to your AI coding assistant (Claude Code, Cursor, etc.) as the system/project prompt.

---

## ROLE

You are a senior full-stack engineer building a production-grade web application from scratch. Follow this specification exactly. Ask clarifying questions only if something is truly ambiguous — otherwise make reasonable engineering decisions consistent with the stack below and document them in code comments.

---

## 1. PRODUCT OVERVIEW

Build **RankBid**, a real-time public leaderboard where projects (startups, apps, products) compete for ranking positions purely by paying money. It is inspired by "Outbit.lol" but with meaningful improvements (see Section 3).

**Core mechanic:**
- A public ranking displays projects ordered strictly by how much was paid to occupy each position — not by merit, revenue, or votes.
- To claim position #1 (or any position), a user must pay **at least $1 more** than the current amount held at that position.
- Paying instantly displaces the current holder and everyone below shifts down one spot.
- Position price is public, live-updating, and creates a bidding-war dynamic.

---

## 2. NON-NEGOTIABLE CORE RULES

1. Ranking state must NEVER be updated from the client. Only a confirmed, server-verified payment (via payment provider webhook) can change the ranking.
2. All bid/position changes must be atomic (DB transaction with row locking) to prevent race conditions when two users try to claim the same position simultaneously.
3. Every bid is an immutable historical record (never overwritten or deleted) — this powers the "price history" viral hook (e.g., "$1 → $23 → $100 → $1,500 → $10,000+").
4. The minimum increment logic must be centralized in one server-side function, never duplicated in the frontend.
5. All monetary amounts stored and computed in integer cents — never floats.

---

## 3. DIFFERENTIATORS FROM THE ORIGINAL (must be implemented)

| Feature | Description |
|---|---|
| Multiple categories | Separate rankings per niche (SaaS, AI, Gaming, Crypto, Other) instead of one global ranking, so more projects can realistically compete for a top spot |
| Enriched project profiles | Logo, description, optional real metrics (users, MRR) shown alongside rank |
| "Reign" system | Track how long a project has held #1; show "Reigning Champion" badge and historical leaderboard of longest reigns |
| Auto-bid / defend subscription | Optional Stripe subscription that automatically re-bids up to a user-defined max to defend a position when outbid |
| Dynamic OG share cards | Auto-generated social share image when a project is dethroned ("X dethroned Y for $450") optimized for X/Twitter and LinkedIn sharing |
| Live activity feed | Real-time feed of bids across all categories on the homepage |
| Fraud protections | Rate limiting, Stripe Radar, email verification, configurable minimum increment (flat or percentage) |

---

## 4. TECH STACK (use exactly this unless a library is deprecated/unavailable)

**Frontend**
- Next.js 14+ (App Router), TypeScript strict mode
- Tailwind CSS + shadcn/ui components
- Framer Motion for ranking position transitions/animations
- next-intl for i18n (see Section 7)

**Backend**
- Next.js Route Handlers for API (monolithic to start; structure code so it could be split into a separate Fastify service later)
- PostgreSQL (via Neon or Supabase — must support serverless connection pooling)
- Prisma ORM for schema management and queries, EXCEPT for the critical bid-claiming transaction, which must use raw SQL with explicit `SELECT ... FOR UPDATE` row locking (Prisma's abstraction is not safe enough for this specific operation — implement it manually)
- Redis (Upstash) for: caching current ranking state, rate limiting, pub/sub for real-time events

**Real-time**
- Pusher or Ably (managed WebSockets) — do not self-host a Socket.io server; prioritize reliability under viral traffic spikes over cost

**Payments**
- Stripe (Payment Intents + Checkout for one-time bids, Subscriptions for auto-bid/defend feature)
- Stripe Radar enabled
- Stripe Webhooks as the ONLY trigger for ranking state changes

**Infra**
- Vercel (frontend + API routes)
- Cloudflare in front of Vercel (CDN, DDoS protection, cache rules for the public ranking page)
- Sentry for error monitoring
- Resend or Postmark for transactional emails (payment confirmation, receipts, "you've been outbid" notification)

---

## 5. DATABASE SCHEMA

Implement via Prisma schema, mirroring this structure:

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  owner_email TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE project_translations (
  project_id UUID REFERENCES projects(id),
  locale TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY (project_id, locale)
);

CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  category_id UUID REFERENCES categories(id),
  amount_cents INTEGER NOT NULL,
  position INTEGER NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending | confirmed | failed | refunded
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE current_ranking (
  category_id UUID REFERENCES categories(id),
  position INTEGER,
  project_id UUID REFERENCES projects(id),
  current_amount_cents INTEGER,
  held_since TIMESTAMPTZ,
  PRIMARY KEY (category_id, position)
);

CREATE TABLE reign_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  category_id UUID REFERENCES categories(id),
  position INTEGER,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER
);

CREATE TABLE auto_bid_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  category_id UUID REFERENCES categories(id),
  position INTEGER,
  max_amount_cents INTEGER NOT NULL,
  stripe_subscription_id TEXT,
  active BOOLEAN DEFAULT true
);
```

---

## 6. CORE LOGIC — ATOMIC POSITION CLAIM

Implement this exact pattern for claiming a position. This must run AFTER Stripe webhook confirms payment, never before:

```typescript
async function claimPosition(
  projectId: string,
  categoryId: string,
  position: number,
  amountCents: number
) {
  return await db.$transaction(async (tx) => {
    const current = await tx.$queryRaw`
      SELECT * FROM current_ranking
      WHERE category_id = ${categoryId} AND position = ${position}
      FOR UPDATE
    `;

    const minRequired = current?.[0]
      ? current[0].current_amount_cents + 100
      : 100;

    if (amountCents < minRequired) {
      throw new InsufficientBidError(minRequired);
    }

    // Close reign history for outgoing holder
    if (current?.[0]) {
      await tx.reign_history.updateMany({
        where: { project_id: current[0].project_id, ended_at: null },
        data: { ended_at: new Date() },
      });
    }

    // Shift lower positions down
    await tx.$executeRaw`
      UPDATE current_ranking SET position = position + 1
      WHERE category_id = ${categoryId} AND position >= ${position}
    `;

    // Insert new holder
    await tx.current_ranking.upsert({
      where: { category_id_position: { category_id: categoryId, position } },
      create: { category_id: categoryId, position, project_id: projectId, current_amount_cents: amountCents, held_since: new Date() },
      update: { project_id: projectId, current_amount_cents: amountCents, held_since: new Date() },
    });

    // Start new reign record
    await tx.reign_history.create({
      data: { project_id: projectId, category_id: categoryId, position, started_at: new Date() },
    });

    return { success: true, position };
  });
}
```

**Payment flow (mandatory order of operations):**
1. Client requests current minimum price for a position (server-computed, never trust client-sent price).
2. Server creates a Stripe Payment Intent for that exact amount.
3. Client completes payment via Stripe Elements/Checkout.
4. Stripe sends `payment_intent.succeeded` webhook.
5. Webhook handler verifies signature, then calls `claimPosition()`.
6. On success, publish event to Redis pub/sub → Pusher broadcasts to all connected clients.
7. Send confirmation email to new holder and "outbid" email to previous holder.

---

## 7. INTERNATIONALIZATION (i18n)

**Library:** `next-intl`

**Locales (exact list, no more no less at launch):** `en` (default), `es`, `zh`, `de`, `ar`, `it`

**Route structure:** `app/[locale]/...` — implement this from day one, even before other locales have translated content, since retrofitting i18n later is significantly more expensive.

**RTL support (Arabic) — mandatory requirements:**
- `<html dir="rtl">` dynamically set per locale in the root layout.
- Use Tailwind logical properties exclusively (`ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`) — never physical `ml-`, `mr-`, `text-left`, `text-right`.
- Mirror directional icons (rank-change arrows) when `dir="rtl"`.
- Verify Framer Motion horizontal transform animations invert correctly on the X axis in RTL mode.
- Keep bid numbers in Western Arabic numerals (0-9) per standard financial UI convention, but confirm with a native speaker before launch.

**What gets translated (system UI):**
- Navigation, buttons, labels, error messages, transactional emails, meta tags/SEO per locale.

**What does NOT get auto-translated:**
- User-submitted project names/descriptions (stored as-is; `project_translations` table is optional Phase-3 functionality only, not MVP).

**Currency:** Always charge in USD via Stripe regardless of locale (avoids exchange-rate race conditions on the same position). Display formatted via `Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' })`.

**SEO:** Generate `hreflang` alternate tags for all 6 locales on every page via `generateMetadata()`.

**Locale switcher:** Persist choice in a cookie; update the `[locale]` segment of the current path on change without losing the current page context.

---

## 8. REAL-TIME SYSTEM

- On confirmed bid, publish `{ type: 'POSITION_TAKEN', categoryId, position, project, amount, previousHolder }` to Redis, relayed to Pusher channel `ranking:{categoryId}`.
- Clients subscribed to the active category channel receive the event and:
  - Animate the ranking reflow with Framer Motion.
  - Show a toast notification (localized).
  - Update the live activity feed component.
- Fallback: if WebSocket connection fails, poll the ranking REST endpoint every 5 seconds.

---

## 9. ANTI-FRAUD & RATE LIMITING

- Redis-backed rate limit: max N bid attempts per IP and per email per minute (define N, e.g., 5/min).
- Require email verification before a project's first listing goes live.
- Enable Stripe Radar; reject/flag payment intents above a configurable `risk_score` threshold.
- Configurable minimum increment: flat ($1) or percentage-based — expose as an environment variable per category to allow tuning without redeploy.
- Clear, published refund policy (e.g., no refund if outbid after N minutes) — display this in the checkout UI, not buried in ToS.

---

## 10. API ENDPOINTS (implement all of these)

```
GET    /api/[locale]/categories
GET    /api/[locale]/rankings/:categorySlug
GET    /api/[locale]/rankings/:categorySlug/history        # price history for viral stats
POST   /api/[locale]/projects                               # submit new project (pending email verification)
POST   /api/[locale]/bids/quote                              # server computes current min price for a position
POST   /api/[locale]/bids/checkout                           # creates Stripe Payment Intent
POST   /api/webhooks/stripe                                  # payment confirmation → claimPosition()
GET    /api/[locale]/projects/:id/og-card                    # dynamic OG image generation
POST   /api/[locale]/auto-bid                                 # create/manage defend subscription
GET    /api/[locale]/leaderboard/reigns                       # longest-reign historical leaderboard
```

---

## 11. NON-FUNCTIONAL REQUIREMENTS

- TypeScript strict mode everywhere; no `any` without justification comment.
- All monetary values as integers (cents).
- Cloudflare cache rules on the public ranking GET endpoint with short TTL (a few seconds) plus cache purge on ranking update event, to survive viral traffic spikes without hammering Postgres.
- Sentry error tracking on both client and server.
- Environment-based config for: minimum increment rules, rate limits, Stripe keys, Redis/Pusher credentials.
- Write integration tests for the `claimPosition` transaction specifically covering concurrent simultaneous bid attempts (this is the highest-risk part of the system).

---

## 12. DELIVERY ROADMAP (build in this order)

**Phase 1 — MVP**
- `[locale]` routing scaffolded with only `en.json` populated
- Single category, basic ranking page, Stripe Checkout (one-time bids only)
- Polling-based updates (no WebSockets yet)
- Deploy to Vercel + Neon/Supabase

**Phase 2 — Real-time & virality**
- Pusher integration for live updates
- Dynamic OG share cards
- Live activity feed

**Phase 3 — Differentiators**
- Multiple categories
- Auto-bid/defend subscriptions
- Reign tracking + historical leaderboard + badges

**Phase 4 — Full i18n rollout**
- Add `es`, `de`, `it` (LTR, faster to integrate)
- Add `zh` (verify font/typography rendering)
- Add `ar` with full RTL implementation last, once layout is stable

**Phase 5 — Hardening for scale**
- Cloudflare cache tuning, load testing the claimPosition transaction under concurrency, fraud rule tuning based on real data

---

## 13. WHAT TO DELIVER FIRST

Start with Phase 1 only. Provide:
1. Full project scaffold with folder structure
2. Prisma schema file
3. The `claimPosition` transaction with tests for concurrent bids
4. Stripe webhook handler
5. Basic ranking page UI with `en` locale working end-to-end

Do not build Phase 2+ features until Phase 1 is confirmed working.
