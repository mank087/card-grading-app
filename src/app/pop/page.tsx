import Link from 'next/link';
import { fetchPopCategories, fetchPopGradeStats } from '@/lib/pop/popData';
import { GRADE_COLUMNS } from '@/lib/popReport';

// Server-rendered: the population report is DCM's own data, and data that only
// exists after a client-side fetch is data no answer engine can cite. Revalidated
// hourly so the page stays a live count without hammering the DB.
export const revalidate = 3600;

const pct = (n: number) => `${n.toFixed(1)}%`;

export default async function PopReportPage() {
  const { categories, totals } = await fetchPopCategories();
  const stats = await fetchPopGradeStats(categories);

  const totalGraded = stats.totalGraded || totals.totalGraded;
  const updatedIso = new Date().toISOString();
  const updatedLabel = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': 'https://dcmgrading.com/pop#dataset',
    name: 'DCM Grading Population Report',
    description:
      `Grade distribution for every card graded by DCM Grading: ${totalGraded.toLocaleString()} graded cards ` +
      `across ${categories.length} categories, broken down by category and by individual card on the whole-number 1 to 10 scale. ` +
      `${pct(stats.gemRate)} of cards graded 10 and ${pct(stats.nineRate)} graded 9.`,
    url: 'https://dcmgrading.com/pop',
    license: 'https://dcmgrading.com/terms',
    isAccessibleForFree: true,
    dateModified: updatedIso,
    creator: { '@id': 'https://dcmgrading.com/#organization' },
    publisher: { '@id': 'https://dcmgrading.com/#organization' },
    keywords: [
      'trading card grading',
      'population report',
      'grade distribution',
      'gem mint rate',
      'card grading statistics',
    ],
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Cards graded', value: totalGraded },
      { '@type': 'PropertyValue', name: 'Unique cards', value: totals.totalUniqueCards },
      { '@type': 'PropertyValue', name: 'Categories', value: categories.length },
      { '@type': 'PropertyValue', name: 'Share graded 10', value: Number(stats.gemRate.toFixed(1)), unitText: 'PERCENT' },
      { '@type': 'PropertyValue', name: 'Share graded 9', value: Number(stats.nineRate.toFixed(1)), unitText: 'PERCENT' },
      ...GRADE_COLUMNS.map((g) => ({
        '@type': 'PropertyValue' as const,
        name: `Cards graded ${g}`,
        value: stats.distribution[g] || 0,
      })),
    ],
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'text/html',
      contentUrl: 'https://dcmgrading.com/pop',
      description:
        'The full distribution is published on this page as HTML tables; per-category breakdowns are at /pop/{category}.',
    },
    hasPart: categories.slice(0, 40).map((c) => ({
      '@type': 'Dataset',
      name: `${c.displayName} population report`,
      url: `https://dcmgrading.com/pop/${c.slug}`,
      description: `${c.totalGraded.toLocaleString()} ${c.displayName} cards graded by DCM across ${c.uniqueCards.toLocaleString()} unique cards.`,
    })),
  };

  const maxGradeCount = Math.max(...GRADE_COLUMNS.map((g) => stats.distribution[g] || 0), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">Population Report</h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">
              Every card graded by DCM, broken down by category and individual card with complete grade distributions.
            </p>

            {/* Platform Stats */}
            {totals.totalGraded > 0 && (
              <div className="flex flex-wrap justify-center gap-8 mt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-300">
                    {totalGraded.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Cards Graded</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-300">
                    {totals.totalUniqueCards.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Unique Cards</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-300">{categories.length}</div>
                  <div className="text-sm text-gray-400 mt-1">Categories</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-300">{pct(stats.gemRate)}</div>
                  <div className="text-sm text-gray-400 mt-1">Graded 10</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Narrative summary — the answer, first, in plain sentences. */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            What percentage of cards get a 10?
          </h2>
          <p className="text-gray-700 text-lg leading-relaxed mb-4">
            Across the {totalGraded.toLocaleString()} cards DCM has graded, {pct(stats.gemRate)} received
            a 10 and {pct(stats.nineRate)} received a 9, so {pct(stats.nineOrBetterRate)} of graded cards
            landed on a 9 or better. Those {totalGraded.toLocaleString()} grades cover{' '}
            {totals.totalUniqueCards.toLocaleString()} unique cards in {categories.length} categories.
            {stats.hardest && stats.easiest && stats.hardest.slug !== stats.easiest.slug ? (
              <>
                {' '}
                Gem rates differ sharply by category: {stats.easiest.displayName} cards reach a 10{' '}
                {pct(stats.easiest.gemRate)} of the time, {stats.hardest.displayName} cards{' '}
                {pct(stats.hardest.gemRate)} of the time.
              </>
            ) : null}{' '}
            Every figure on this page is counted from DCM&apos;s own grading records, not estimated.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            DCM grades on whole numbers from 1 to 10 with no half grades, and the final grade is the
            lowest of the four subgrades &mdash; centering, corners, edges and surface &mdash; so one weak
            area caps the card. What most often does the capping is centering. In DCM&apos;s own published
            v8.6 analysis of 8,000+ graded cards (mid-2026), centering was the limiting factor on{' '}
            <strong>41.8%</strong> of cards, and it was the reason a card missed a 10 in{' '}
            <strong>72.7%</strong> of cards that graded 9. The published standard those grades are
            scored against is at{' '}
            <Link href="/grading-standard" className="text-purple-600 hover:text-purple-800">
              /grading-standard
            </Link>
            , and its known limits at{' '}
            <Link href="/grading-limitations" className="text-purple-600 hover:text-purple-800">
              /grading-limitations
            </Link>
            .
          </p>
          <p className="text-sm text-gray-500">
            Counted live from the DCM grading database. Last updated {updatedLabel}. These are DCM
            grades only; they are not a population count for any other grading company.
          </p>
        </section>

        {/* Platform-wide grade distribution */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-12">
          <div className="px-6 pt-6 pb-3">
            <h2 className="text-xl font-bold text-gray-900">Grade distribution, all categories</h2>
            <p className="text-sm text-gray-500 mt-1">
              Every DCM grade issued, by whole-number grade.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                DCM Grading population report: number and share of cards at each grade from 1 to 10
              </caption>
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <th scope="col" className="text-left px-6 py-3 font-semibold text-gray-700">
                    Grade
                  </th>
                  <th scope="col" className="text-right px-6 py-3 font-semibold text-gray-700">
                    Cards
                  </th>
                  <th scope="col" className="text-right px-6 py-3 font-semibold text-gray-700">
                    Share
                  </th>
                  <th scope="col" className="text-left px-6 py-3 font-semibold text-gray-700 w-1/2">
                    <span className="sr-only">Relative volume</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...GRADE_COLUMNS].reverse().map((g) => {
                  const count = stats.distribution[g] || 0;
                  const share = totalGraded > 0 ? (count / totalGraded) * 100 : 0;
                  return (
                    <tr key={g} className="border-b border-gray-100">
                      <th scope="row" className="text-left px-6 py-2 font-medium text-gray-900">
                        {g}
                      </th>
                      <td className="px-6 py-2 text-right tabular-nums text-gray-700">
                        {count.toLocaleString()}
                      </td>
                      <td className="px-6 py-2 text-right tabular-nums text-gray-700">
                        {pct(share)}
                      </td>
                      <td className="px-6 py-2">
                        <div
                          className="h-2 rounded bg-purple-500"
                          style={{ width: `${Math.max((count / maxGradeCount) * 100, 0.5)}%` }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <th scope="row" className="text-left px-6 py-3 font-semibold text-gray-900">
                    Total
                  </th>
                  <td className="px-6 py-3 text-right font-semibold tabular-nums text-gray-900">
                    {totalGraded.toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-right font-semibold tabular-nums text-gray-900">
                    100%
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Gem rate by category */}
        {stats.rankedCategories.length > 1 && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-12">
            <div className="px-6 pt-6 pb-3">
              <h2 className="text-xl font-bold text-gray-900">Rate of 10s by category</h2>
              <p className="text-sm text-gray-500 mt-1">
                Categories with at least 250 DCM grades, hardest to easiest.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-y border-gray-200">
                    <th scope="col" className="text-left px-6 py-3 font-semibold text-gray-700">
                      Category
                    </th>
                    <th scope="col" className="text-right px-6 py-3 font-semibold text-gray-700">
                      Cards graded
                    </th>
                    <th scope="col" className="text-right px-6 py-3 font-semibold text-gray-700">
                      Graded 10
                    </th>
                    <th scope="col" className="text-right px-6 py-3 font-semibold text-gray-700">
                      Rate of 10s
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.rankedCategories.map((c) => (
                    <tr key={c.slug} className="border-b border-gray-100">
                      <th scope="row" className="text-left px-6 py-2 font-medium text-gray-900">
                        <Link href={`/pop/${c.slug}`} className="hover:text-purple-600">
                          {c.displayName}
                        </Link>
                      </th>
                      <td className="px-6 py-2 text-right tabular-nums text-gray-700">
                        {c.totalGraded.toLocaleString()}
                      </td>
                      <td className="px-6 py-2 text-right tabular-nums text-gray-700">
                        {c.tens.toLocaleString()}
                      </td>
                      <td className="px-6 py-2 text-right tabular-nums font-semibold text-gray-900">
                        {pct(c.gemRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Category Grid */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">Browse by category</h2>
        {categories.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">No graded cards yet. Be the first!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/pop/${cat.slug}`}
                className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-purple-300 transition-all"
              >
                <div className="text-3xl mb-3">{cat.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors mb-3">
                  {cat.displayName}
                </h3>
                <div className="space-y-1 text-sm text-gray-500">
                  <div>{cat.totalGraded.toLocaleString()} graded</div>
                  <div>{cat.uniqueCards.toLocaleString()} unique cards</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-16">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Want to add your cards to the report?
          </h2>
          <p className="text-gray-600 mb-6">
            Get your cards graded with DCM and they&apos;ll automatically appear here.
          </p>
          <Link
            href="/upload"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-md"
          >
            Get Your Cards Graded
          </Link>
        </div>
      </div>
    </div>
  );
}
