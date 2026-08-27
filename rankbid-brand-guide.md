# RankBid — Brand Guide

## 1. Brand concept

**"Launch, don't apply."** RankBid frames every bid as a countdown-to-liftoff moment: a pastel, airy "sky" backdrop (order, calm, modernity) punctuated by a near-black "mission control" ink used for numbers and data. The bidding amount is always rendered in a dark pill with monospace tabular digits — like a telemetry readout — so the one truly dynamic, urgent element of the page (the price) reads as precise and alive against an otherwise quiet, disciplined layout.

**Signature element:** the **Telemetry Ticker** — bid amounts in `JetBrains Mono`, tabular numerals, white-on-ink pill, with a subtle odometer-style digit flip animation when a position changes hands. This is the one recurring motif that should appear anywhere a price is shown (ranking rows, checkout, share cards, emails).

---

## 2. Color palette

Pastel base for calm/order/modernity, near-black ink for sharp contrast, one warm accent for bid urgency, one soft gold for status/rank.

| Name | Hex | RGB | Role |
|---|---|---|---|
| **Cloud** | `#F4F2FC` | 244, 242, 252 | Primary background (pale lavender-white) |
| **Mint fog** | `#E8F6F0` | 232, 246, 240 | Secondary background / alternating rows / confirmed states |
| **Void ink** | `#14131F` | 20, 19, 31 | Primary text, data pills, header bar — the sharp dark contrast |
| **Signal coral** | `#FF6B54` | 255, 107, 84 | Primary CTA, "place bid" buttons, live/urgent indicators |
| **Champagne** | `#EFC272` | 239, 194, 114 | #1 position marker, "reigning champion" badge, trophy/status accents |
| **Periwinkle** | `#B9B3F0` | 185, 179, 240 | Secondary accent — category tags, links, position #2–3 markers |

**Neutrals (derived, for text hierarchy on Cloud/white):**

| Name | Hex | Use |
|---|---|---|
| Ink 90 (Void) | `#14131F` | Headings, primary text |
| Ink 60 | `#5A5870` | Secondary text, captions, timestamps |
| Ink 30 | `#B3B1C4` | Disabled text, hairline borders on dark |
| Border | `rgba(20,19,31,0.10)` | Card borders, dividers on light surfaces |

**Contrast rule (mandatory):** Any surface using Cloud, Mint fog, Champagne, or Periwinkle as a *background* must pair with Void ink text (never mid-gray, never pure black `#000`). This is what produces the "light pastel with sharp dark contrast" identity — soft color fields, crisp dark type on top. Signal coral is dark enough at full saturation to carry white text; use `#4A0F05` (coral-900) for text *on* pale coral tints instead of pure black.

**Dark mode:** Invert the relationship — Void ink (`#14131F`) becomes the page background, Cloud becomes the primary text color, and the pastel accents (Mint, Champagne, Periwinkle) drop to 15–20% opacity fills with their saturated hue used only for text/icons, so the "pastel = calm" feeling survives even in dark mode.

**Accessibility:** Void ink on Cloud = contrast ratio ~16:1 (AAA). Void ink on Champagne = ~9:1 (AAA). Void ink on Periwinkle = ~8:1 (AAA). White on Signal coral = ~3.9:1 — acceptable for large/bold text and icons only; use Void ink instead for body-size text on coral.

---

## 3. Typography

Three roles, each with a distinct job — avoid defaulting to a single family for everything.

| Role | Typeface | Source | Weights used |
|---|---|---|---|
| **Display** | Bricolage Grotesque | Google Fonts (free, variable) | 500, 700 |
| **Body / UI** | Plus Jakarta Sans | Google Fonts (free, variable) | 400, 500, 600 |
| **Data / mono** | JetBrains Mono | Google Fonts (free) | 400, 500, 700 |

**Why this pairing:** Bricolage Grotesque has enough personality (slightly irregular grotesque forms) to feel distinctive on headlines and the logotype without tipping into novelty. Plus Jakarta Sans is a clean geometric-humanist body face — more character than Inter, still highly legible at small UI sizes. JetBrains Mono has true tabular figures, which is non-negotiable for a product where numbers visibly tick upward in real time.

### Type scale

| Token | Size / line-height | Weight | Family | Use |
|---|---|---|---|---|
| `display-xl` | 48px / 1.1 | 700 | Bricolage Grotesque | Hero headline |
| `display-lg` | 34px / 1.15 | 700 | Bricolage Grotesque | Section headers |
| `display-md` | 22px / 1.2 | 500 | Bricolage Grotesque | Card titles, project names in ranking |
| `body-lg` | 17px / 1.6 | 400 | Plus Jakarta Sans | Lead paragraphs |
| `body-md` | 15px / 1.6 | 400 | Plus Jakarta Sans | Default body text |
| `body-sm` | 13px / 1.5 | 400/500 | Plus Jakarta Sans | Captions, metadata, timestamps |
| `label` | 12px / 1.4, uppercase, +0.02em tracking | 600 | Plus Jakarta Sans | Eyebrows, tags |
| `data-lg` | 20px / 1.2 | 700 | JetBrains Mono | Featured bid amount (checkout, hero) |
| `data-md` | 14px / 1.3 | 500 | JetBrains Mono | Bid pill in ranking rows |
| `data-sm` | 12px / 1.3 | 400 | JetBrains Mono | Timestamps, IDs |

**Rule:** Never use JetBrains Mono for prose — only for numbers, currency, timestamps, and IDs. Never use Bricolage Grotesque below 18px — it loses legibility at small sizes; drop to Plus Jakarta Sans 600 for small bold moments instead.

---

## 4. Logo direction

Wordmark-first (no separate pictorial mark needed at launch): "RankBid" set in Bricolage Grotesque 700, Void ink on light backgrounds / Cloud on dark. The only graphic device is a small Signal coral dot replacing the "i" tittle in "Bid" — a quiet nod to a live/active indicator (like a live-stream dot), without resorting to a literal trophy, arrow, or podium icon (avoid these — overused in ranking/leaderboard products).

Minimum clear space: height of the "R" on all sides. Do not recolor the wordmark in Signal coral or Champagne — it must always run in Void ink or Cloud for legibility and restraint; those colors are reserved for UI accents, not the identity mark.

---

## 5. Spacing, radius & elevation

| Token | Value |
|---|---|
| `radius-sm` | 8px (buttons, pills, inputs) |
| `radius-md` | 12px (cards) |
| `radius-lg` | 16px (modals, featured cards) |
| `space-xs / sm / md / lg / xl` | 4 / 8 / 16 / 24 / 40px |
| Borders | 0.5–1px hairline, `rgba(20,19,31,0.10)` on light, `rgba(244,242,252,0.12)` on dark — never heavier |
| Shadows | Avoid drop shadows; use flat surfaces + hairline borders + the Cloud/Mint tonal shift to separate layers. This keeps the "orderly, modern, simple" feeling — shadows read as dated/skeuomorphic here. |

---

## 6. Voice & tone

Plain, confident, sentence case, verb-first. The product is inherently a bit absurd (paying to rank higher) — the copy should be straight-faced and matter-of-fact rather than winking at it, which makes the mechanic feel more legitimate, not less.

- Buttons: "Claim #1", "Defend your spot", "Place bid" — never "Submit" or "Buy now".
- Live feed: "Nimbus AI took #1 for $10,482" — factual, no exclamation marks.
- Errors: "That bid's too low. Minimum is $10,483." — states the fix, no apology.
- Empty state (new category): "No one's claimed a spot yet. Be first." — invitation, not filler text.

---

## 7. Application quick-reference

| Element | Background | Text/foreground | Accent |
|---|---|---|---|
| Page background | Cloud `#F4F2FC` | Void ink | — |
| Ranking row card | White `#FFFFFF` | Void ink | Coral/Champagne pill for amount |
| #1 row marker | Champagne `#EFC272` | Ink on champagne `#4A3105` | — |
| Primary CTA button | Signal coral `#FF6B54` | Void ink `#14131F` (bold) | — |
| Category tag | Periwinkle 15% tint | Periwinkle-900 `#241F5C` | — |
| Bid amount pill | Void ink `#14131F` | Cloud `#F4F2FC`, JetBrains Mono | — |
| Confirmed/success state | Mint fog `#E8F6F0` | Ink on mint `#12402F` | — |

---

## 8. What to avoid

- No gradients — flat color fields only; gradients undercut the "orderly/modern/simple" brief.
- No literal trophy, medal, crown, or podium iconography — the Champagne accent and the Telemetry Ticker already communicate rank; literal icons read as generic/templated.
- No pure black (`#000000`) or pure gray text anywhere — always Void ink or its tints, to keep the palette cohesive.
- No more than one Signal coral CTA visible at a time per screen — it's the loudest color in the system and loses urgency if overused.
