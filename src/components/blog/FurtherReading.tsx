import Link from 'next/link';

/**
 * "Further reading" — a small, topical set of internal links appended to a blog
 * post, chosen from the post's own tags (plus its category) rather than hand
 * curated per post.
 *
 * This is a server component on purpose: the mapping is static, so there is
 * nothing to hydrate.
 */

interface FurtherReadingProps {
  tags?: string[] | null;
  /** Category slug, e.g. "grading-guides". Matched like a tag. */
  categorySlug?: string | null;
  /** Category display name. Matched like a tag. */
  categoryTitle?: string | null;
}

/** Every page Further reading is allowed to point at, with its one-liner. */
const PAGES: Record<string, { label: string; description: string }> = {
  '/fastest-card-grading': {
    label: 'Fastest card grading',
    description: 'Published turnaround times for the mail-in graders, next to a 60-second grade.',
  },
  '/cheapest-card-grading': {
    label: 'Cheapest card grading',
    description: 'What each service charges per card once shipping and insurance are counted.',
  },
  '/card-grading-companies': {
    label: 'Card grading companies compared',
    description: 'PSA, BGS, SGC, CGC, TAG and DCM on price, turnaround, method and format.',
  },
  '/psa-alternative': {
    label: 'The PSA alternative',
    description: 'What a photo-based grade replaces, and what it honestly does not.',
  },
  '/grading-rubric': {
    label: 'The grading rubric',
    description: 'Centering, corners, edges and surface, and what moves each subgrade.',
  },
  '/grading-standard': {
    label: 'The DCM grading standard',
    description: 'The versioned rubric every grading pass is scored against.',
  },
  '/grading-limitations': {
    label: 'Honest limitations',
    description: 'What a photo-based grade can and cannot see, stated plainly.',
  },
  '/ai-card-grading': {
    label: 'How DCM Optic grades',
    description: 'Three independent passes, median consensus, and the checks that run first.',
  },
  '/ai-card-grading-accuracy': {
    label: 'Is AI card grading accurate?',
    description: 'The method, the confidence letter, and how to check the grade yourself.',
  },
  '/pop': {
    label: 'Population report',
    description: 'Every grade DCM has issued, aggregated and public, broken out by category.',
  },
  '/featured': {
    label: 'Featured grades',
    description: 'Real grading reports from the community, start to finish.',
  },
  '/reports-and-labels': {
    label: 'Reports and labels',
    description: 'What comes back with a grade: subgrades, defect log and a printable label.',
  },
  '/labels': {
    label: 'Slab labels',
    description: 'Label designs for magnetic holders, one-touches and toploaders.',
  },
  '/instalist-marketplace': {
    label: 'InstaList for eBay',
    description: 'Turn a graded card into a listing with the condition breakdown embedded.',
  },
  '/market-pricing': {
    label: 'Market pricing',
    description: 'How DCM values a card from live comps rather than a stale price guide.',
  },
  '/pokemon-grading': {
    label: 'Pokémon card grading',
    description: 'Holo scratches, edge whitening and vintage centering, graded at magnification.',
  },
  '/sports-grading': {
    label: 'Sports card grading',
    description: 'Rookies, parallels and vintage, matched against the real set data.',
  },
  '/get-started': {
    label: 'Get started',
    description: 'The whole flow, from two photos to a graded card, in about a minute.',
  },
  '/why-dcm': {
    label: 'Why DCM',
    description: 'The case for grading at home before you pay anyone to grade for you.',
  },
};

/**
 * Ordered rules. A rule fires when any tag (or the category) contains one of its
 * substrings, case-insensitively. Earlier rules win the limited slots.
 */
const RULES: { match: string[]; links: string[] }[] = [
  { match: ['turnaround', 'how long', 'instant'], links: ['/fastest-card-grading', '/card-grading-companies'] },
  { match: ['cost', 'worth grading', 'which cards'], links: ['/cheapest-card-grading', '/card-grading-companies'] },
  { match: ['psa', 'bgs', 'sgc', 'cgc', 'comparison'], links: ['/psa-alternative', '/card-grading-companies'] },
  {
    match: ['centering', 'corners', 'edges', 'surface', 'subgrade', 'gem mint', 'defect'],
    links: ['/grading-rubric', '/grading-standard'],
  },
  { match: ['weakest link', 'method', 'dcm optic'], links: ['/grading-standard', '/ai-card-grading'] },
  { match: ['confidence', 'uncertainty', 'transparency'], links: ['/grading-limitations', '/ai-card-grading-accuracy'] },
  { match: ['pop report', 'distribution', 'grades a 10'], links: ['/pop', '/featured'] },
  { match: ['slab', 'label', 'toploader', 'one-touch'], links: ['/reports-and-labels', '/labels'] },
  { match: ['ebay', 'listing', 'sell'], links: ['/instalist-marketplace', '/reports-and-labels'] },
  { match: ['value', 'comps', 'worth', 'pricing'], links: ['/market-pricing', '/pop'] },
  { match: ['pokemon', 'pokémon'], links: ['/pokemon-grading'] },
  { match: ['sports'], links: ['/sports-grading'] },
];

const FALLBACK = ['/get-started', '/why-dcm'];

const MAX_LINKS = 3;

/** Exported for tests and for reuse anywhere else a topical link set is wanted. */
export function pickFurtherReading(
  tags?: string[] | null,
  categorySlug?: string | null,
  categoryTitle?: string | null
): string[] {
  const haystack = [...(tags || []), categorySlug || '', categoryTitle || '']
    .filter(Boolean)
    .map((t) => t.toLowerCase());

  const picked: string[] = [];
  for (const rule of RULES) {
    const hit = rule.match.some((m) => haystack.some((h) => h.includes(m)));
    if (!hit) continue;
    for (const link of rule.links) {
      if (!picked.includes(link) && PAGES[link]) picked.push(link);
      if (picked.length >= MAX_LINKS) return picked;
    }
  }

  if (picked.length === 0) return FALLBACK.slice(0, MAX_LINKS);
  return picked;
}

export default function FurtherReading({ tags, categorySlug, categoryTitle }: FurtherReadingProps) {
  const links = pickFurtherReading(tags, categorySlug, categoryTitle);

  if (links.length === 0) return null;

  return (
    <div className="mt-10 pt-6 border-t border-gray-200">
      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
        Further reading
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {links.map((href) => (
          <Link
            key={href}
            href={href}
            className="block p-4 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all"
          >
            <span className="block font-semibold text-purple-700 mb-1">
              {PAGES[href].label} &rarr;
            </span>
            <span className="block text-sm text-gray-600">{PAGES[href].description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
