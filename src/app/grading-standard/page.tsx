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

export default function GradingStandardPage() {
  const markdown = readStandard();

  return (
    <main className="min-h-screen bg-white">
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
