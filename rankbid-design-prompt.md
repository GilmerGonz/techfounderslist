# MASTER DESIGN PROMPT — RankBid
### Send this to an AI design/frontend tool (Claude, v0, Cursor, Figma AI, etc.)

Copy everything below this line.

---

## ROLE

You are a senior product designer and frontend engineer with a distinctive visual point of view. Design and build the UI for **RankBid**, applying the brand system below with precision. Do not default to generic SaaS-template patterns (centered hero + 3 feature cards + gray footer). Every screen must feel like it could only belong to this specific product.

---

## 1. WHAT THE PRODUCT IS

RankBid is a live, public leaderboard where startups and products compete for ranking positions by paying money — the highest bidder holds the top spot until someone outbids them by at least $1. There is no vote, no algorithm, no merit scoring: rank is purely a function of the current highest payment. The site is organized into categories (SaaS, AI, Gaming, Crypto, Other), each with its own independent leaderboard.

The emotional core of the product is **watching a number climb in real time** — the tension of a live auction combined with the ego/status game of "who's willing to pay the most to be seen." Design for that tension: the page should feel alive, slightly urgent, but never chaotic or cluttered.

---

## 2. BRAND SYSTEM TO APPLY (non-negotiable tokens)

**Concept:** "Launch, don't apply." A calm, pastel, orderly "sky" backdrop punctuated by near-black "mission control" ink used only for data — numbers, timestamps, bid amounts. The bid price is the one loud, alive element on an otherwise quiet, disciplined page.

**Colors:**
- Cloud `#F4F2FC` — primary page background (pale lavender-white)
- Mint fog `#E8F6F0` — secondary background, alternating rows, confirmed/success states
- Void ink `#14131F` — primary text, data pills, header — the sharp dark contrast against the pastels
- Signal coral `#FF6B54` — primary CTA ("Place bid"), live/urgent indicators, the "heat" color
- Champagne `#EFC272` — #1 position marker, reigning-champion badge
- Periwinkle `#B9B3F0` — category tags, secondary links, positions #2–3 accent
- Ink 60 `#5A5870` — secondary/muted text
- Border `rgba(20,19,31,0.10)` — hairline dividers only, never heavier

**Contrast rule:** Every pastel or accent background pairs with Void ink text — never pure black, never mid-gray. This dark-on-pastel pairing IS the identity; do not soften it with gray text.

**Typography:**
- Display: **Bricolage Grotesque**, weights 500/700 — headlines, card titles, the wordmark
- Body/UI: **Plus Jakarta Sans**, weights 400/500/600 — all UI text, labels, paragraphs
- Data: **JetBrains Mono**, weights 400/500/700, tabular numerals — EVERY number that represents money, a timestamp, or an ID. Never render a dollar amount in the body or display face.

**Signature element — the Telemetry Ticker:** every bid amount anywhere in the product is shown as a Void-ink pill (`border-radius: 8px`, padding ~6px 10px) containing white/Cloud JetBrains Mono text. When the amount updates live, the digits perform a brief odometer-style flip/roll animation (150–220ms per digit, slight stagger left-to-right) rather than a plain fade or snap. This motif must recur identically across the ranking rows, the checkout summary, the share cards, and transactional emails — it is the one repeated visual signature that ties the whole product together.

**Forbidden:** gradients, drop shadows, literal trophy/medal/crown/podium icons, pure black or gray text, more than one Signal coral CTA visible at once per screen.

---

## 3. GLOBAL LAYOUT PRINCIPLES

- **Grid:** 12-column, max content width 1200px, generous side margins (min 24px mobile, 80px+ desktop) — the page should breathe; this is not a dense dashboard.
- **Corners:** 8px on pills/buttons/inputs, 12px on cards, 16px on modals/featured elements.
- **Elevation without shadows:** separate layers using flat color shifts only (white card on Cloud page background, Mint fog for a "settled/confirmed" tier) plus 0.5–1px hairline borders. No box-shadow anywhere in the default design.
- **Motion philosophy:** motion is reserved for things that are actually changing state (a bid landing, a rank reflow, a digit ticking). Static content does not animate on scroll or load — restraint is part of the brand's "orderly, modern, simple" promise. The one place to be expressive with motion is the ranking reflow itself.
- **Iconography:** thin-line, geometric icons only (1.5px stroke), Void ink or Ink 60 — no filled icons, no illustrated/cartoon icon sets. Icons are functional signposts, never decoration.

---

## 4. PAGE-BY-PAGE DESIGN SPECIFICATION

### 4.1 Header (persistent, all pages)

- Height 64px, Cloud background, 1px hairline border-bottom in Border color — no shadow.
- Left: wordmark "RankBid" in Bricolage Grotesque 700, Void ink, with the Signal coral dot replacing the "i" tittle in "Bid" (per logo spec) — this dot has a very subtle 2s pulse (opacity 100%→70%→100%) to read as "live," echoing a stream indicator.
- Center-left: category navigation as a horizontal pill tab bar (SaaS / AI / Gaming / Crypto / Other) — active tab gets a Void ink filled pill with Cloud text; inactive tabs are plain Ink-60 text with no border, generous horizontal padding (16–20px) so the row feels calm, not cramped.
- Right: locale switcher (flag-free — use language name abbreviations "EN / ES / 中文 / DE / AR / IT" in a simple dropdown, Ink 60 text) followed by the primary CTA button "Submit project" in Signal coral, Void ink bold text, 8px radius.
- On scroll past 80px, header background stays solid Cloud (no glassmorphism/blur — flat only) with the hairline border slightly darkened to `border-strong`.

### 4.2 Homepage / Category ranking (the core screen)

**Hero band (top ~280px, not full viewport height — this is a utility product, not a marketing landing page):**
- Left-aligned (not centered — centering everything is the generic default; here left-alignment mirrors the left-to-right reading order of the ranking list directly beneath it, creating visual continuity).
- Eyebrow label, small caps, Ink 60: "Live · [category name]"
- Headline in Bricolage Grotesque 700, 40–48px, Void ink: e.g. "Who's paying the most to be seen today."
- One line of supporting copy in Plus Jakarta Sans, Ink 60, 17px: plain, factual, not salesy — e.g. "Rank is bought, not earned. Outbid #1 to take the top spot."
- Directly below, inline (not a separate section): a single live stat rendered in the Telemetry Ticker style — current #1 price — so the hero itself demonstrates the product's core mechanic instead of describing it abstractly.

**Ranking list (the signature screen element):**
- Each row is a white card (`#FFFFFF`) on the Cloud page background, 12px radius, 0.5px hairline border, comfortable padding (14–16px vertical), NOT edge-to-edge table rows — each position is visually a discrete, almost collectible object, reinforcing that a position was individually purchased.
- Row anatomy, left to right:
  1. Rank number in Bricolage Grotesque 700, 20–22px — Void ink for #2 and below, but position #1's number sits inside a small Champagne circular badge instead of plain text.
  2. Project logo/avatar, 32–36px square, 8px radius.
  3. Project name (Bricolage Grotesque 500, 15px, Void ink) stacked above a metadata line (Plus Jakarta Sans 400, 12px, Ink 60): "Reigning 2h 14m" for the current holder, or "Outbid 4m ago" for displaced projects — this reign/outbid framing is a differentiator from the original and must always be present, not just the price.
  4. Category tag as a small Periwinkle-tinted pill (15% tint background, Periwinkle-900 text), shown only on the "all categories" combined view.
  5. Right-aligned: the Telemetry Ticker pill with the current amount. #1's ticker uses full-strength Void ink background; positions #2 and below use a lighter Ink-60-bordered version (outline, transparent fill) so #1 visually "pops" against the row of runners-up without needing a separate banner or ribbon.
- Row order changes are animated: when a new bid lands, the displaced rows slide down smoothly (280ms ease-out) and the new #1 row briefly flashes a soft Champagne background wash (fades over 900ms) before settling to white — celebratory but not gaudy, no confetti or emoji.
- Below the list: a **live activity feed** as a slim, single-line-per-event ticker (not a card grid) in Ink 60, small JetBrains Mono for the amount, continuously appending new entries at the top with a gentle 200ms slide-in — e.g. "Ledgerly outbid Nimbus AI for #1 — $10,482" — this is peripheral, ambient information, deliberately understated relative to the main ranking.

**Empty category state:** Mint fog card, centered icon (a simple outline "flag" or "plus" glyph, never a trophy), headline "No one's claimed a spot yet," body "Be the first to list a project here," Signal coral "Submit project" button — an invitation, matching the brand voice rules (never "Nothing here yet").

### 4.3 Project detail / bid page

- Two-column layout on desktop (60/40 split): left column shows the project's profile (logo, name, description, external link icon, optional real metrics like users/MRR displayed as small Mint fog metric chips — deliberately secondary, smaller type, to reinforce "these numbers don't determine your rank, only your bid does"); right column is a sticky bid panel.
- Bid panel: white card, 16px radius, containing the current minimum required amount rendered LARGE in the `data-lg` JetBrains Mono style inside a Void ink pill, a single numeric input pre-filled with that minimum (user can increase it, never decrease), and the primary Signal coral "Place bid" button beneath. Below the button, small Ink-60 text states the refund policy plainly, no fine print styling — treat it as content, not a legal afterthought.
- Below the fold: the price history for this position rendered as a simple stepped line/area chart (Void ink line, Cloud fill under the curve, Champagne dot marking the current value) — this visualizes the "$1 → $23 → $100 → $10,000" escalation that is core to the product's viral appeal.

### 4.4 Submit project flow

- A single-column, generously-spaced form (max-width 560px, centered) — this is the one screen where centering is correct, because there's no adjacent list to align against.
- Fields: project name, URL, logo upload, one-line description, owner email, category select (styled as the same pill tabs used in the header, so the pattern feels familiar). Inputs use the standard field styling: white fill, 1px `border`, Void ink text, focus state = 2px Signal coral outline (the one place a heavier border is intentional, per accent rules).
- Submit button: Signal coral, full-width on mobile, right-aligned on desktop, label "List project" (not "Submit" — verb-first per voice rules).

### 4.5 Reign leaderboard (differentiator page)

- A distinct, secondary ranking: not "who's #1 now" but "who has held #1 the longest, ever." Table-style layout (this is the one screen where a dense table is appropriate, since it's historical/comparative data, not a live collectible list) with columns: rank, project, longest reign duration (JetBrains Mono), category tag. Header row in Mint fog, Void ink text, sentence case, no uppercase table headers.

---

## 5. RESPONSIVE BEHAVIOR

- **Mobile (< 640px):** Category tabs become a horizontally scrollable pill row (no dropdown — keep them tappable and visible, since switching categories is a primary action). Ranking rows stack the metadata line beneath the project name rather than beside it; the Telemetry Ticker pill moves to its own row, right-aligned, full visual weight preserved. Hero headline drops to 28–32px.
- **Tablet (640–1024px):** Two-column project detail collapses to single column with the bid panel appearing directly under the project profile (not sticky).
- **Desktop (1024px+):** Full layout as specified above.

---

## 6. DARK MODE

Invert the field, not the accents' role: Void ink `#14131F` becomes the page background; Cloud `#F4F2FC` becomes primary text. Mint fog, Champagne, and Periwinkle drop to 15–20% opacity fills with their full-saturation hue reserved for text/icon color on top of that fill (so a Champagne badge becomes a translucent gold wash with bright Champagne text, not a solid pastel block, which would look chalky on a dark page). Signal coral stays fully saturated in both modes — it is the one color that should feel identical day and night, since it always means the same thing: "act now."

---

## 7. RTL (ARABIC) ADAPTATION NOTES FOR THIS DESIGN SPECIFICALLY

- The rank-number-and-badge cluster and the Telemetry Ticker pill must swap sides: in RTL, rank number/badge sits on the right edge of the row and the ticker pill sits on the left, mirroring the LTR layout exactly rather than keeping ticker "right-aligned" literally — "end-aligned" is the correct concept, not "right-aligned."
- The live activity feed's slide-in animation direction inverts (entries slide in from the left in RTL).
- The reign-duration progress/flip animation on the Telemetry Ticker digits should NOT mirror — digits always read left-to-right even inside an RTL layout, since they're numerals, not text; only the pill's position and surrounding layout flip.

---

## 8. WHAT TO DELIVER

1. A component inventory (header, ranking row, telemetry ticker, category tab, bid panel, activity feed item, empty state) as reusable, isolated components before assembling full pages.
2. The homepage/category ranking screen fully built first — it is the product's core screen and every other page borrows patterns from it.
3. Light mode only for the first pass; add dark mode and RTL as a second pass once the light-mode LTR version is approved.
4. Do not add any element, badge, or animation not specified above without flagging it as a proposed addition — the brief is intentionally precise to avoid template drift.
