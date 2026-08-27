# MASTER DESIGN PROMPT — The Tech Founders List
### Send this to an AI design/frontend tool (Claude, v0, Cursor, Figma AI, etc.)

Copy everything below this line.

---

## ROLE

You are a senior product designer with a background in financial/editorial publishing interfaces (think Bloomberg Terminal, The Information, institutional research dashboards) as much as consumer SaaS. Design and build the UI for **The Tech Founders List** (short reference: Techfounderslist), applying the brand system below with precision. This must NOT look like a gamified startup leaderboard — it must look like a private index a serious operator would screenshot into a pitch deck without embarrassment.

---

## 1. WHAT THE PRODUCT IS

The Tech Founders List is a live index where tech startups hold positions that are claimed by outbidding the current position holder by at least $1. Underneath, the mechanic is identical to a pay-to-rank auction — but nothing in the presentation should say that plainly or playfully. The framing is: **capital committed is a costly, credible signal of conviction** — closer to how a lead investor's check size signals seriousness on a cap table than to a game leaderboard. Categories exist (AI, SaaS, Fintech, Infra, Consumer) as separate indices, each with independent position-holders.

The emotional register is **quiet confidence**, not excitement. A founder or investor visiting the page should feel like they're reading something consequential and understated — the opposite of a countdown clock or a confetti animation.

---

## 2. BRAND SYSTEM TO APPLY (non-negotiable tokens)

**Colors:**
- Paper `#F7F4EE` — primary background (warm ivory, not white, not pastel)
- Ink `#14161C` — primary text, data pills, header — the dark contrast against Paper
- Ledger green `#1F4D3A` — primary CTA ("Claim position"), the only accent used for action
- Brass `#A9822F` — current position-holder marker, used sparingly
- Slate `#4C5B73` — category tags, secondary links
- Ink 60 `#5B5A52` — secondary/muted text
- Border `rgba(20,22,28,0.12)` — hairline dividers only

**Contrast rule:** every background pairs with Ink text — never mid-gray, never pure black. Ledger green and Brass are deliberately desaturated — nothing on this page should look bright, playful, or app-store-consumer.

**Typography:**
- Display/editorial: **Fraunces**, weights 500/600 — headlines, masthead wordmark, section titles only, never below 20px
- Body/UI: **IBM Plex Sans**, weights 400/500/600 — all UI text, labels, paragraphs
- Data: **IBM Plex Mono**, tabular numerals — every figure: position price, timestamp, ID. Never render a number in the body or display face.

**Signature element — the Index Ticker:** every position figure renders as an Ink-outlined pill (not filled — this is a change from a prior filled-pill concept; an outlined pill reads as "data readout," a filled pill reads as "badge/game token") containing IBM Plex Mono tabular numerals. On update, digits perform a fast, quiet tabular roll (120–160ms, linear easing, no bounce/overshoot/spring) — precision, not celebration. This must recur identically anywhere a figure appears: index rows, position-claim panel, transactional emails.

**Forbidden:** gradients, drop shadows, filled colorful badges, rounded/bubbly corners above 8px, countdown or rocket-launch imagery/copy, trophy/medal/crown/podium icons, exclamation points in UI copy, more than one Ledger green CTA visible per screen.

---

## 3. GLOBAL LAYOUT PRINCIPLES

- **Grid:** 12-column, max content width 1120px (slightly narrower than a typical SaaS landing page — narrower columns read as edited/curated, like a printed index page, not a sprawling dashboard).
- **Corners:** 4px on buttons/inputs, 6px on cards, 8px on modals — deliberately tight; large radii were retired along with the old pastel brand.
- **Elevation without shadows:** white cards on Paper background, a single darker Paper tone (`#EFEBE1`) for a "settled" tier, hairline Ink-12% borders. No box-shadow anywhere.
- **Motion philosophy:** even more restrained than before — the ONLY animated elements are the Index Ticker digit roll and a position reflow when someone is outranked (a slow, deliberate 220ms ease, not a springy bounce). No hover-lift, no scroll-triggered fade-ins, no micro-celebrations. Stillness is part of the premium signal.
- **Iconography:** thin-line (1px stroke, thinner than the previous 1.5px spec), Ink or Ink-60 only, used sparingly — prefer typographic solutions (a label, a number) over an icon wherever both would work equally well.

---

## 4. PAGE-BY-PAGE DESIGN SPECIFICATION

### 4.1 Header (persistent, all pages)

- Height 56px (down from 64px — tighter, denser, more "terminal" than "app"), Paper background, 1px hairline border-bottom, no shadow.
- Left: wordmark in the shortened form "Techfounderslist" set in IBM Plex Sans 600 (NOT Fraunces here — Fraunces is reserved for the homepage masthead only, per brand guide), Ink, no icon, no colored dot, no pulse animation.
- Center-left: category tabs (AI / SaaS / Fintech / Infra / Consumer) as plain text tabs with a 2px Ink underline on the active tab — no filled pill background (filled pills read as "app navigation"; underlined text tabs read as "publication section navigation," e.g. how a news site does "World / Business / Tech").
- Right: locale switcher (plain text dropdown, Ink-60) and the single CTA "Submit company" in a thin Ink-bordered button (outline style, NOT filled Ledger green — reserve the filled Ledger green treatment exclusively for the position-claim action, so it retains maximum weight where it matters most).

### 4.2 Homepage / Category index (the core screen)

**Masthead band (top ~220px, tighter than before):**
- Left-aligned, matching the index list below.
- Full wordmark "The Tech Founders List" in Fraunces 600, 36–42px, Ink — this is the one place the full serif wordmark appears prominently.
- One line, IBM Plex Sans, Ink-60, 16px: plain and factual, e.g. "An index of tech companies, ordered by committed capital." No hype adjectives.
- Below: a single Index Ticker showing the current #1 figure, outlined pill style — demonstrates the mechanic without narrating it.

**Index list (the signature screen element):**
- Each row: white card on Paper, 6px radius, hairline border, 12–14px vertical padding — slightly tighter than before, reads as a dense, serious table rather than a collection of "collectible" cards.
- Row anatomy, left to right:
  1. Position number in IBM Plex Mono 500 (NOT the display serif — using mono for the rank number ties it visually to "data," not "trophy"), Ink for all positions. Position #1 gets a small Brass underline beneath the number — restrained, not a badge or circle.
  2. Company logo, 28px square, 4px radius (smaller and sharper-cornered than the previous spec).
  3. Company name (IBM Plex Sans 600, 14px, Ink) with a metadata line beneath (IBM Plex Sans 400, 12px, Ink-60): "Holding since [date]" for the current holder, "Outranked [date]" for others — factual tense, no "reigning"/"dethroned" gamified language.
  4. Category tag: small Slate-tinted text label, no pill background — just colored text, even more understated than an outlined tag.
  5. Right-aligned: the Index Ticker (outlined pill, Ink border, Ink text, IBM Plex Mono figure) — same visual weight for every row; #1 is distinguished only by the Brass underline under its position number, not by a different-colored ticker. This is a deliberate change from the old design (where #1's pill was visually louder) — restraint applies even to the leader.
- Row reflow animation: 220ms ease, no color flash, no confetti — the row simply moves to its new position smoothly.
- Below the list: an activity log, not a "feed" — styled as plain text lines in a monospace-adjacent rhythm (timestamp in IBM Plex Mono, description in IBM Plex Sans), reading like a transaction log or an audit trail rather than a social feed.

**Empty category state:** Plain Paper card, no icon, text only: "No position claimed in this category yet." + outline-style "Submit company" button. No illustration, no friendly copy.

### 4.3 Company detail / claim-position page

- Two-column, 65/35 split. Left: company profile — logo, name, one-line description, external link (text link style, Slate, underlined, not a button), optional real metrics (users, ARR) shown as plain labeled text pairs, not colorful chips — e.g. "ARR — $1.2M" in Ink-60 label + Ink value, no background fill at all, reinforcing that these numbers are informational, not competing visually with the position figure.
- Right: claim panel, white card, 8px radius. Current minimum figure shown LARGE in IBM Plex Mono inside an outlined Ink pill. Numeric input below, pre-filled with minimum. Primary action: filled Ledger green button, "Claim position" — this is the one moment on the page that gets full-saturation color treatment, which is exactly why it must stay singular. Beneath: refund/terms text in Ink-60, plain sentence, no legal-box styling.
- Below the fold: position price history as a simple stepped line, Ink line on Paper, a single small Brass dot marking the current value — no fill/area color under the curve (a filled area chart reads as "consumer analytics app"; a bare line reads as "financial chart").

### 4.4 Submit company flow

- Single column, max-width 520px, centered — the one appropriate use of centering, same logic as before.
- Fields styled minimally: label above input, thin Ink-12% border, 4px radius, focus state = 1.5px Ledger green border (not coral — action color is now green throughout).
- Submit button: outline style (Ink border, Ink text) — reserve the filled Ledger green treatment for the claim-position action specifically, keeping this form's submission visually secondary to the core "claim" moment elsewhere in the product.

### 4.5 Historical index (longest-held positions)

- Dense table layout (appropriate here, same logic as before): position, company, duration held (IBM Plex Mono), category (Slate text label). Header row: Ink-60 text on Paper, sentence case, thin bottom border only — no filled header background.

---

## 5. RESPONSIVE BEHAVIOR

- **Mobile (<640px):** Category tabs become a horizontally scrollable underlined-text row. Metadata line stacks beneath company name. Index Ticker moves to its own right-aligned row, same outline treatment. Masthead wordmark drops to 26–28px, Fraunces still used (do not swap to sans on mobile — the serif at smaller sizes still reads better than losing the editorial identity entirely).
- **Tablet:** Company detail collapses to single column, claim panel directly beneath profile, not sticky.
- **Desktop:** Full spec as above.

---

## 6. DARK MODE

Ink becomes the page background, Paper becomes primary text. Brass and Ledger green remain fully saturated in both modes. Category tag text (Slate) lightens to maintain contrast but keeps the same understated, non-pill treatment.

---

## 7. RTL (ARABIC) NOTES

Same principles as before — position number/Brass-underline cluster and the Index Ticker swap to end-aligned rather than literally right-aligned; numerals inside the ticker remain left-to-right regardless of layout direction; activity log entries reverse their append direction.

---

## 8. WHAT TO DELIVER

1. Component inventory first: header, index row, Index Ticker (outlined pill), category tab (underline style), claim panel, activity log line, empty state.
2. Build the homepage/category index screen first — it anchors every other page's restraint level.
3. Light mode, LTR only for the first pass.
4. Do not introduce any rounded corner above 8px, any filled colorful badge, or any celebratory animation anywhere — these are the specific failure modes that would pull this back toward the old "cheap gamified leaderboard" look this brief is explicitly moving away from.
