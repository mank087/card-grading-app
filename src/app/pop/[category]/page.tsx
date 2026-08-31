import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchPopCards, fetchCategoryGradeStats } from '@/lib/pop/popData';
import { GRADE_COLUMNS } from '@/lib/popReport';
import PopCategoryTable from './PopCategoryTable';

// The category table is DCM's own data, so it is rendered on the server and
// revalidated hourly. Search, sorting and paging stay client-side, fed with the
// server's first page.
export const revalidate = 3600;

const PAGE_SIZE = 50;
const pct = (n: number) => `${n.toFixed(1)}%`;

export default async function PopCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;

  let data;
  try {
    data = await fetchPopCards({ slug, limit: PAGE_SIZE, offset: 0 });
  } catch (err) {
    console.error('Pop category page error:', err);
    notFound();
  }

  const { category, cards, pagination } = data;

  // Sub-category reports live inside "Other", which the grade-count filter
  // cannot express, so they get the table without the distribution summary.
  const gradeStats = category.dbSubCategory
    ? null
    : await fetchCategoryGradeStats(category.dbCategory);

  const totalGraded = gradeStats?.totalGraded ?? cards.reduce((sum, c) => sum + c.total, 0);
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
    '@id': `https://dcmgrading.com/pop/${slug}#dataset`,
    name: `${category.displayName} Population Report — DCM Grading`,
    description:
      `Grade distribution for every ${category.displayName} card graded by DCM Grading: ` +
      `${totalGraded.toLocaleString()} graded cards across ${pagination.total.toLocaleString()} unique cards, ` +
      `on the whole-number 1 to 10 scale` +
      (gradeStats ? `, of which ${pct(gradeStats.gemRate)} graded 10.` : '.'),
    url: `https://dcmgrading.com/pop/${slug}`,
    license: 'https://dcmgrading.com/terms',
    isAccessibleForFree: true,
    dateModified: updatedIso,
    creator: { '@id': 'https://dcmgrading.com/#organization' },
    publisher: { '@id': 'https://dcmgrading.com/#organization' },
    isPartOf: { '@id': 'https://dcmgrading.com/pop#dataset' },
    keywords: [category.displayName, 'population report', 'grade distribution', 'card grading'],
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Cards graded', value: totalGraded },
      { '@type': 'PropertyValue', name: 'Unique cards', value: pagination.total },
      ...(gradeStats
        ? GRADE_COLUMNS.map((g) => ({
            '@type': 'PropertyValue' as const,
            name: `Cards graded ${g}`,
            value: gradeStats.distribution[g] || 0,
          }))
        : []),
    ],
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'text/html',
      contentUrl: `https://dcmgrading.com/pop/${slug}`,
      description: 'The per-card breakdown is published on this page as an HTML table.',
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dcmgrading.com' },
      { '@type': 'ListItem', position: 2, name: 'Population Report', item: 'https://dcmgrading.com/pop' },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${category.displayName} Population Report`,
        item: `https://dcmgrading.com/pop/${slug}`,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-purple-900 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Breadcrumb */}
          <nav className="flex items-center text-sm text-gray-400 mb-4">
            <Link href="/pop" className="hover:text-white transition-colors">
              Pop Report
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white">{category.displayName}</span>
          </nav>

          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{category.icon}</span>
            <h1 className="text-3xl sm:text-4xl font-bold">{category.displayName}</h1>
          </div>
          <p className="text-gray-300">
            {pagination.total.toLocaleString()} unique cards &middot;{' '}
            {totalGraded.toLocaleString()} total graded
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Server-rendered summary: the answer before the table. */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            {category.displayName} cards graded by DCM
          </h2>
          <p className="text-gray-700 leading-relaxed">
            DCM has issued {totalGraded.toLocaleString()} grades on {category.displayName} cards,
            covering {pagination.total.toLocaleString()} unique cards.
            {gradeStats ? (
              <>
                {' '}
                {pct(gradeStats.gemRate)} of them graded 10 and {pct(gradeStats.nineOrBetterRate)}{' '}
                graded 9 or better.
              </>
            ) : null}{' '}
            Grades are whole numbers from 1 to 10, and the final grade is the lowest of the four
            subgrades &mdash; centering, corners, edges and surface. The table below lists each card
            with the number of times it has received each grade.
          </p>
          {gradeStats && (
            <div className="mt-4 overflow-x-auto">
              <table className="text-sm">
                <caption className="sr-only">
                  {category.displayName} grade distribution across all DCM grades
                </caption>
                <thead>
                  <tr className="border-b border-gray-200">
                    <th scope="col" className="text-left pr-4 py-1 font-semibold text-gray-700">
                      Grade
                    </th>
                    {GRADE_COLUMNS.map((g) => (
                      <th key={g} className="px-3 py-1 font-semibold text-gray-700 text-right">
                        {g}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className="text-left pr-4 py-1 font-medium text-gray-700">
                      Cards
                    </th>
                    {GRADE_COLUMNS.map((g) => (
                      <td key={g} className="px-3 py-1 text-right tabular-nums text-gray-700">
                        {(gradeStats.distribution[g] || 0).toLocaleString()}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-3">
            Counted from DCM&apos;s own grading records. Last updated {updatedLabel}. DCM grades
            only &mdash; this is not a population count for any other grading company.
          </p>
        </div>

        <PopCategoryTable
          category={{
            slug: category.slug,
            dbCategory: category.dbCategory,
            displayName: category.displayName,
            icon: category.icon,
          }}
          initialCards={cards}
          initialPagination={pagination}
        />
      </div>
    </div>
  );
}
