'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CategoryData {
  slug: string;
  dbCategory: string;
  displayName: string;
  icon: string;
  uniqueCards: number;
  totalGraded: number;
}

interface Totals {
  totalUniqueCards: number;
  totalGraded: number;
}

export default function PopReportPage() {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [totals, setTotals] = useState<Totals>({ totalUniqueCards: 0, totalGraded: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pop/categories')
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories || []);
        setTotals(data.totals || { totalUniqueCards: 0, totalGraded: 0 });
      })
      .catch((err) => console.error('Failed to load pop categories:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              Population Report
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">
              Every card graded by DCM, broken down by category and individual card with complete grade distributions.
            </p>

            {/* Platform Stats */}
            {!loading && totals.totalGraded > 0 && (
              <div className="flex flex-wrap justify-center gap-8 mt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-300">
                    {totals.totalGraded.toLocaleString()}
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
                  <div className="text-3xl font-bold text-purple-300">
                    {categories.length}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Categories</div>
                </div>
              </div>
            )}
            {loading && (
              <div className="flex justify-center gap-8 mt-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="text-center">
                    <div className="h-9 w-20 bg-gray-700 rounded animate-pulse mx-auto" />
                    <div className="h-4 w-16 bg-gray-700 rounded animate-pulse mx-auto mt-2" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
                <div className="h-10 w-10 bg-gray-200 rounded-lg mb-4" />
                <div className="h-5 w-24 bg-gray-200 rounded mb-3" />
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-gray-100 rounded" />
                  <div className="h-3 w-16 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
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
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors mb-3">
                  {cat.displayName}
                </h2>
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
          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            Want to add your cards to the report?
          </h3>
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
