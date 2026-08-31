import { Metadata } from 'next';
import Link from 'next/link';
import * as fs from 'fs';
import * as path from 'path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const metadata: Metadata = {
  title: 'The DCM Grading Standard',
  description:
    'The published, versioned standard DCM grades to. Scoring ladders for centering, corners, edges and surface, the weakest-link rule, structural caps, and how confidence is reported.',
  keywords:
    'DCM grading standard, card grading criteria, grading scale, weakest link grading, centering measurement, card grading rubric, trading card grading standards',
  openGraph: {
    title: 'The DCM Grading Standard',
    description: 'The published, versioned standard DCM grades to.',
    type: 'article',
    siteName: 'DCM Grading',
  },
  alternates: {
    canonical: 'https://dcmgrading.com/grading-standard',
  },
};

// Rendered from docs/DCM_GRADING_STANDARD.md so the published page and the
// document of record cannot drift apart. A standard whose page disagrees with
// its own source is worse than no standard, so there is deliberately only one
// copy of these words in the repository.
function readStandard(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'docs', 'DCM_GRADING_STANDARD.md'),
    'utf8'
  );
}

// The standard carries its own version line ("**Version 1.1** · Effective
// 31 August 2026 · Engine `DCM_Grading_v9.23`"). Schema dates are read from the
// document itself so the page cannot claim a date the standard does not.
const STANDARD_URL = 'https://dcmgrading.com/grading-standard';
const ORG_ID = 'https://dcmgrading.com/#organization';
const FALLBACK_EFFECTIVE_ISO = '2026-08-26';

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function effectiveDateIso(markdown: string): string {
  const m = markdown.match(/Effective\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return FALLBACK_EFFECTIVE_ISO;
  const monthIndex = MONTHS.indexOf(m[2].toLowerCase());
  if (monthIndex < 0) return FALLBACK_EFFECTIVE_ISO;
  return `${m[3]}-${String(monthIndex + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function versionLabel(markdown: string): string {
  const m = markdown.match(/\*\*Version\s+([\d.]+)\*\*/);
  return m ? `Version ${m[1]}` : 'Version 1.0';
}

/**
 * The terms answer engines repeat about DCM most often, and get wrong most
 * often. Defining them here, in schema, gives them something to quote that
 * matches the standard verbatim.
 */
function definedTermSetJsonLd(markdown: string) {
  const terms = [
    {
      name: 'Weakest-link grading',
      description:
        'DCM’s rule for combining subgrades: the final grade is the lowest of the four subgrades, not their average. A card with centering 8, corners 10, edges 10 and surface 10 grades 8.',
    },
    {
      name: 'Whole-number scale',
      description:
        'DCM grades on whole numbers from 1 to 10. There are no decimals and no half grades, so no 9.5 and no 8.5.',
    },
    {
      name: 'Centering subgrade',
      description:
        'One of the four subgrades. Scores how evenly the card’s image sits inside its borders, measured as the left-to-right and top-to-bottom border ratios on each face.',
    },
    {
      name: 'Corners subgrade',
      description:
        'One of the four subgrades. Scores the sharpness of all four corners on both faces, covering fraying, whitening, softening and blunting.',
    },
    {
      name: 'Edges subgrade',
      description:
        'One of the four subgrades. Scores the four edges on both faces, covering chipping, whitening, nicks and rough cuts.',
    },
    {
      name: 'Surface subgrade',
      description:
        'One of the four subgrades. Scores the printed faces themselves, covering scratches, print lines, dimples, creases, stains, gloss loss and print defects.',
    },
    {
      name: 'Image confidence',
      description:
        'A letter from A to D published with every DCM grade, reporting how well the submitted photographs supported the evaluation, together with an uncertainty range. It grades the photographs, not the card: a low letter means retake the photos before acting on the grade.',
    },
    {
      name: 'Three-pass consensus',
      description:
        'Every card is evaluated three independent times against the same published standard, and the result is settled by consensus across those three passes, so a single outlier read cannot decide the grade.',
    },
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${STANDARD_URL}#terms`,
    name: 'DCM Grading Standard: defined terms',
    description:
      'The terms used in the DCM Grading Standard, defined as the standard defines them.',
    url: STANDARD_URL,
    publisher: { '@id': ORG_ID },
    dateModified: effectiveDateIso(markdown),
    hasDefinedTerm: terms.map((t, i) => ({
      '@type': 'DefinedTerm',
      '@id': `${STANDARD_URL}#term-${i + 1}`,
      name: t.name,
      description: t.description,
      inDefinedTermSet: { '@id': `${STANDARD_URL}#terms` },
    })),
  };
}

function techArticleJsonLd(markdown: string) {
  const iso = effectiveDateIso(markdown);
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    '@id': `${STANDARD_URL}#article`,
    headline: 'The DCM Grading Standard',
    name: `The DCM Grading Standard (${versionLabel(markdown)})`,
    description:
      'The published, versioned standard DCM grades to: scoring ladders for centering, corners, edges and surface, the weakest-link rule, structural caps, and how confidence is reported.',
    inLanguage: 'en',
    datePublished: iso,
    dateModified: iso,
    version: versionLabel(markdown).replace('Version ', ''),
    mainEntityOfPage: STANDARD_URL,
    url: STANDARD_URL,
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    about: [
      { '@type': 'Thing', name: 'Trading card grading' },
      { '@type': 'Thing', name: 'Card condition assessment' },
      { '@type': 'Thing', name: 'Weakest-link grading' },
      { '@type': 'Thing', name: 'Card centering measurement' },
    ],
    mentions: { '@id': `${STANDARD_URL}#terms` },
    isAccessibleForFree: true,
    license: 'https://dcmgrading.com/terms',
  };
}

export default function GradingStandardPage() {
  const markdown = readStandard();

  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleJsonLd(markdown)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermSetJsonLd(markdown)) }}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="mb-8 text-sm">
          <Link href="/grading-rubric" className="text-purple-600 hover:text-purple-800">
            &larr; How we grade
          </Link>
        </nav>

        <article
          className="
            prose prose-slate max-w-none
            prose-headings:font-bold prose-headings:text-gray-900
            prose-h1:text-4xl prose-h1:mb-2
            prose-h2:text-2xl prose-h2:mt-12 prose-h2:pb-2 prose-h2:border-b prose-h2:border-gray-200
            prose-h3:text-lg prose-h3:mt-8
            prose-p:text-gray-700 prose-li:text-gray-700
            prose-a:text-purple-600 hover:prose-a:text-purple-800
            prose-strong:text-gray-900
            prose-table:text-sm
            prose-th:bg-gray-50 prose-th:text-gray-900 prose-th:font-semibold
            prose-td:align-top
            prose-blockquote:border-l-4 prose-blockquote:border-amber-400
            prose-blockquote:bg-amber-50 prose-blockquote:py-1 prose-blockquote:not-italic
            prose-code:before:content-none prose-code:after:content-none
            prose-hr:border-gray-200
          "
        >
          {/* Wide scoring tables must scroll inside themselves rather than
              pushing the page sideways on a phone. */}
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto">
                  <table {...props} />
                </div>
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        </article>
      </div>
    </main>
  );
}
