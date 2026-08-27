# The Tech Founders List — Brand Guide
### (domain: techfounderslist.com)

## 1. Brand concept

**"The index that founders earn their way onto — with capital."** This is no longer a meme leaderboard. The Tech Founders List reads like a private, editorial index — the kind of publication a serious operator would actually want to be seen in, closer to a Bloomberg terminal or a members-only industry report than a viral ranking site. The mechanic underneath is unchanged (positions are claimed by outbidding the current holder), but nothing in the visual language should reveal that at a glance. The product should look like it belongs on a VC's second monitor, not on a meme account's retweet.

**Reframe the core copy concept:** instead of "pay to rank," the language is "**capital signals conviction**" — paying to hold a position is framed as a costly, credible signal (the same logic behind why VCs read cap tables and lead-investor commitments as proof of seriousness), not an ego stunt. This single reframe is what separates "cheap" from "premium" — same mechanic, entirely different meaning.

**Signature element — the Index Ticker:** every amount (bid, valuation-style figure, position price) renders as a monospace, tabular-numeral readout inside a thin-bordered ink pill — restrained, terminal-style, not a loud colored badge. Think Bloomberg/Reuters ticker, not a game-show scoreboard. Digits update with a quiet, fast tabular roll (120–160ms, no bounce, no overshoot) — precision, not celebration.

---

## 2. Color palette

Moved from playful pastel-and-coral to **paper, ink, brass, and ledger green** — the palette of a private prospectus, not a launch party.

| Name | Hex | RGB | Role |
|---|---|---|---|
| **Paper** | `#F7F4EE` | 247, 244, 238 | Primary background — warm ivory, evokes a printed index/prospectus, not a tech pastel |
| **Ink** | `#14161C` | 20, 22, 28 | Primary text, header, data pills — the sharp dark contrast |
| **Ledger green** | `#1F4D3A` | 31, 77, 58 | Primary CTA ("Claim position"), the one accent that signals "money/growth," replaces the old urgent coral |
| **Brass** | `#A9822F` | 169, 130, 47 | #1 position marker, "current leader" indicator — muted metal, not a bright pastel gold |
| **Slate** | `#4C5B73` | 76, 91, 115 | Secondary accent — category tags, links, supporting UI |
| **Ink 60** | `#5B5A52` | 91, 90, 82 | Secondary/muted text, captions, timestamps (warm gray, not cool gray — keeps it feeling "paper," not "software") |
| **Border** | `rgba(20,22,28,0.12)` | — | Hairline dividers only |

**Contrast rule (unchanged in spirit):** every background pairs with Ink text — never mid-gray, never pure black `#000`. The difference from before is *saturation*, not the contrast logic: Ledger green and Brass are both deliberately muted/desaturated versions of "money" and "status" colors, so nothing on the page reads as bright, playful, or discount-app.

**What changed and why:**
- Coral → Ledger green: coral read as "urgent app notification"; deep green reads as "capital/growth," a color vocabulary borrowed from finance, not consumer apps.
- Champagne (pastel gold) → Brass: pastel gold felt like a party favor; brass feels like an engraved plaque.
- Lavender/Mint pastels → Paper: soft startup pastels signaled "fun product"; warm ivory paper signals "serious publication."
- Periwinkle → Slate: same role (tags/links), but a muted blue-gray instead of a bright pastel purple.

**Dark mode:** Ink becomes the background, Paper becomes primary text. Brass and Ledger green stay fully saturated in both modes — status and action should never look washed out, day or night.

---

## 3. Typography

Three roles, now borrowing from editorial/financial publishing rather than consumer SaaS.

| Role | Typeface | Source | Weights |
|---|---|---|---|
| **Display / editorial** | Fraunces | Google Fonts (free, variable) | 500, 600 |
| **Body / UI** | IBM Plex Sans | Google Fonts (free) | 400, 500, 600 |
| **Data / index figures** | IBM Plex Mono | Google Fonts (free), tabular numerals | 400, 500, 600 |

**Why this pairing:** Fraunces is a serif with real editorial weight — the same instinct behind why *The Economist*, *The Information*, and *Bloomberg Businessweek* lean serif for headlines: it reads as authored and considered, not templated. IBM Plex Sans/Mono are a matched family originally built for enterprise/fintech contexts (IBM), so body text and data figures feel like they come from the same disciplined design system — this is what "not cheap" looks like at the typographic level: nothing feels like a free Google Fonts grab-bag, it feels specified.

**Rule:** Fraunces only above 20px (headlines, wordmark, section titles) — it's a display face, not a workhorse; using it small breaks the premium effect instead of reinforcing it. IBM Plex Mono is reserved exclusively for numbers/amounts/timestamps/IDs, same discipline as before.

---

## 4. Logo direction

Wordmark: **"The Tech Founders List"** set in Fraunces 600, Ink on Paper. No icon, no coral dot, no live-indicator gimmick — the previous "live pulse dot" read as consumer-app energy; here, restraint IS the signal of seriousness. If a mark is needed for small spaces (favicon, social avatar), use the initials **"TFL"** in Fraunces, set inside a thin single-line Ink square — no fill, no gradient, no rounded playful shape.

Domain/short reference in running text and UI chrome (nav bar, footer, emails): **"Techfounderslist"** — one word, lowercase-friendly, used the way people would actually type or say it. The full serif wordmark is reserved for the homepage masthead and formal touchpoints (the way a publication uses its full nameplate on the front page but a shortened handle everywhere else).

---

## 5. Spacing, radius & elevation

| Token | Value | Change from before |
|---|---|---|
| `radius-sm` | 4px (buttons, inputs) | Down from 8px — sharper corners read as more formal/editorial, less "friendly app" |
| `radius-md` | 6px (cards) | Down from 12px |
| `radius-lg` | 8px (modals) | Down from 16px |
| `space-xs/sm/md/lg/xl` | 4/8/16/24/40px | Unchanged |
| Borders | 0.5–1px hairline, Ink at 12% opacity | Unchanged principle |
| Shadows | Still none — flat surfaces, tonal shifts (Paper vs. white), hairline rules only | Unchanged, and now doubly correct: financial/editorial layouts (think a term sheet or a stock table) never use drop shadows |

**Rationale for tighter radii:** rounded-heavy UI is consumer-app shorthand (Duolingo, Robinhood-for-teens energy); sharper, smaller radii are what you see in Bloomberg Terminal, institutional banking dashboards, and serious publishing sites — a small, consistent shift that does a lot of the "not cheap" work on its own.

---

## 6. Voice & tone

Shift from "confident startup" to "understated authority." Say less, assume the reader is sophisticated, never sell.

- Buttons: "Claim position," "Hold your rank," "Review index" — no exclamation points, no "!"-driven urgency copy like the old "Place bid" energy implied.
- Index feed: "Nimbus AI holds position #1 — $10,482" — a stated fact, not an announcement.
- Errors: "Minimum to claim this position is $10,483." — plain, no apology, no drama.
- Empty state: "No position claimed in this category yet." — declarative, not an invitation with an exclamation mark; premium brands don't beg.
- **Avoid entirely:** "war," "battle," "flex," "ego," or any gamified language from the old brand voice — those words undercut the "serious index" positioning immediately.

---

## 7. Application quick-reference

| Element | Background | Text/foreground | Accent |
|---|---|---|---|
| Page background | Paper `#F7F4EE` | Ink | — |
| Index row card | White `#FFFFFF` | Ink | Ledger green/Brass pill for figure |
| #1 row marker | Brass `#A9822F`, 12% tint | Ink | — |
| Primary CTA | Ledger green `#1F4D3A` | Paper (bold) | — |
| Category tag | Slate 12% tint | Slate-900 `#1E2733` | — |
| Index figure pill | Ink `#14161C` | Paper, IBM Plex Mono | — |
| Confirmed state | Paper, darker tonal shift `#EFEBE1` | Ink | — |

---

## 8. What to avoid (updated for this reposition)

- No pastel palette anywhere — the previous lavender/mint/coral system is retired entirely, not just muted.
- No rounded, bubbly UI chrome (large radii, soft drop shadows, cartoon icon sets) — this reads as consumer app, undercuts high-ticket B2B credibility.
- No countdown/rocket-launch imagery or copy ("liftoff," "launch," "ignite") — that vocabulary belongs to the old RankBid brand, not this one.
- No literal trophy/crown/podium icons (same rule as before, still applies).
- No exclamation points in UI copy, ever.
