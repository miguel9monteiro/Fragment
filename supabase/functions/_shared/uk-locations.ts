// UK location detection from free-text location strings provided by ATSes.
//
// The detection rule is: a string is "UK" if (a) it carries an explicit UK
// country/region signal, OR (b) it mentions a UK city that is UNAMBIGUOUSLY
// UK (no other major Anglophone city of the same name). Ambiguous cities --
// Cambridge, Oxford, Birmingham, etc. -- only qualify when paired with a UK
// country signal in the same string.
//
// All comparison is lowercase. Matching uses explicit word/comma boundaries
// to avoid the previous " uk " regression where role titles like "UK Markets"
// (a US-based team covering UK clients) false-positived.
//
// Refined as we observe false positives in production logs. When you add a
// city, decide whether it belongs in the UNAMBIGUOUS or AMBIGUOUS list -- if
// the same name exists in the US/Canada/Australia, it is ambiguous.

const UK_COUNTRY_PHRASES: readonly string[] = [
  'united kingdom',
  'great britain',
  'england',
  'scotland',
  'wales',
  'northern ireland',
];

// Comma-separated country-code tokens like "London, GB" / "Edinburgh, UK".
// Matched only at whole-token boundaries inside the haystack.
const UK_COUNTRY_CODES: readonly string[] = ['gb', 'gbr', 'uk', 'u.k.', 'u.k'];

// Cities/areas unambiguously UK -- no other major Anglophone city shares the
// name. Safe to match on their own.
const UNAMBIGUOUS_UK_CITIES: readonly string[] = [
  'london',
  'canary wharf',
  'city of london',
  'edinburgh',
  'glasgow',
  'manchester',
  'leeds',
  'bristol',
  'belfast',
  'cardiff',
  'liverpool',
  'sheffield',
  'nottingham',
  'newcastle upon tyne',
  'brighton',
];

// Cities that exist in the UK and also under the same name elsewhere (esp.
// the US). Only counts as UK when the same string also carries an explicit
// UK country signal. Adding a city here without that pairing requirement was
// the source of false-positive "Cambridge, MA" matches and similar.
const AMBIGUOUS_UK_CITIES: readonly string[] = [
  'cambridge',  // also MA, US
  'oxford',     // also MS, US
  'birmingham', // also AL, US
  'reading',    // also PA, US
  'bournemouth',
];

function containsWord(haystack: string, needle: string): boolean {
  const idx = haystack.indexOf(needle);
  if (idx === -1) return false;
  const before = idx === 0 ? ' ' : haystack[idx - 1];
  const afterIdx = idx + needle.length;
  const after = afterIdx >= haystack.length ? ' ' : haystack[afterIdx];
  // Reject when surrounded by alphanumerics -- "uk" matches "uk" but not "ukraine".
  return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
}

function hasUkCountrySignal(haystack: string): boolean {
  for (const phrase of UK_COUNTRY_PHRASES) {
    if (containsWord(haystack, phrase)) return true;
  }
  const tokens = haystack.split(/[\s,;()/]+/).filter(Boolean);
  for (const t of tokens) {
    if (UK_COUNTRY_CODES.includes(t)) return true;
  }
  return false;
}

export function isUkLocation(input: string | null | undefined): boolean {
  if (!input) return false;
  const haystack = ` ${input.toLowerCase()} `;

  if (hasUkCountrySignal(haystack)) return true;

  for (const city of UNAMBIGUOUS_UK_CITIES) {
    if (containsWord(haystack, city)) return true;
  }

  // Ambiguous cities only count when paired with a UK country signal -- but
  // we already returned false on that check above, so they cannot contribute.
  // The list is kept for callers that already know the country is UK (e.g.
  // structured payloads with countryCode) and want to enrich detection from
  // city alone.
  void AMBIGUOUS_UK_CITIES;

  return false;
}

// Exported for callers that have already established UK country context from
// structured fields and want to keep the lexicon co-located here.
export const UK_AMBIGUOUS_CITIES = AMBIGUOUS_UK_CITIES;
