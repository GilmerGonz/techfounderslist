/**
 * Generate a deterministic stock-style ticker symbol from a company name —
 * purely cosmetic, nothing is persisted. Deterministic by design: the same
 * name always yields the same symbol, so SSR and client render identically
 * (no hydration mismatch).
 *
 * Algorithm: normalise the name, drop common filler tokens, then take the
 * first letter followed by the next relevant consonants (topped up with the
 * remaining letters if there aren't enough), fixed at 4 chars, uppercase.
 * Examples: "Nimbus AI" -> "NMBS", "Codex Labs" -> "CDXL", "SpaceX" -> "SPCX".
 */

const FILLER =
  /\b(the|a|an|inc|inc\.|ltd|ltd\.|llc|llc\.|corp|corp\.|co|co\.|ai|tech|technologies|group|gmbh|s\.l\.)\b/gi;
const NON_ALPHA = /[^a-z]/gi;
const VOWELS = /[aeiou]/;
const TARGET = 4;

export function companyTicker(name: string): string {
  const cleaned = name
    .replace(FILLER, ' ')
    .replace(NON_ALPHA, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const letters = cleaned.toLowerCase().replace(/\s+/g, '').split('');
  const first = letters[0] ?? 'X';
  const rest = letters.slice(1);

  // Consonants first (in order), then top up with the remaining letters
  // (vocals etc.) so the symbol always reaches TARGET length.
  const pool: string[] = [];
  const consonants = rest.filter((c) => !VOWELS.test(c));
  for (const ch of consonants) if (!pool.includes(ch)) pool.push(ch);
  for (const ch of rest) if (!pool.includes(ch)) pool.push(ch);

  let symbol = (first + pool.join('')).toUpperCase().slice(0, TARGET);
  while (symbol.length < TARGET) symbol += 'X';
  return symbol;
}
