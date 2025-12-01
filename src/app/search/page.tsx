'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface CardResult {
  id: string;
  serial: string;
  sport_type: string;
  category?: string;
  visibility: string;
  front_url: string;
  player_name: string;
  year: string;
  manufacturer: string;
  set_name: string;
  subset?: string;
  dvg_decimal_grade: number;
  conversational_decimal_grade?: number;
  created_at: string;
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const initialSerial = searchParams?.get('serial') || '';

  const [searchQuery, setSearchQuery] = useState(initialSerial);
  const [results, setResults] = useState<CardResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-search if serial provided in URL
  useEffect(() => {
    if (initialSerial) {
      performSearch(initialSerial);
    }
  }, [initialSerial]);

  const performSearch = async (serial: string) => {
    if (!serial.trim()) {
      setError('Please enter a serial number');
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(false);

    try {
      const response = await fetch(`/api/cards/search?serial=${encodeURIComponent(serial)}&visibility=public`);

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.cards || []);
      setHasSearched(true);
    } catch (err: any) {
      setError(err.message || 'Failed to search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  // Helper to get the correct card detail link based on category
  const getCardLink = (card: CardResult) => {
    const category = card.category || card.sport_type;
    const sportCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];

    if (category && sportCategories.includes(category)) {
      return `/sports/${card.id}`;
    }
    if (category === 'Pokemon') {
      return `/pokemon/${card.id}`;
    }
    if (category === 'MTG') {
      return `/mtg/${card.id}`;
    }
    if (category === 'Lorcana') {
      return `/lorcana/${card.id}`;
    }
    if (category === 'Other') {
      return `/other/${card.id}`;
    }
    return `/sports/${card.id}`; // Default fallback
  };

  // Helper to get the grade
  const getGrade = (card: CardResult) => {
    return card.conversational_decimal_grade ?? card.dvg_decimal_grade;
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">🔍 Search Graded Cards</h1>
        <p className="text-gray-600">Search for publicly shared cards by serial number</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter serial number (e.g., DCM-2024-001234)"
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-8">
          <p className="text-red-800 font-semibold">⚠️ {error}</p>
        </div>
      )}

      {/* Results */}
      {hasSearched && (
        <div>
          <div className="mb-4">
            <p className="text-gray-700 font-semibold">
              Found {results.length} {results.length === 1 ? 'card' : 'cards'}
            </p>
          </div>

          {results.length === 0 ? (
            <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">No Cards Found</h2>
              <p className="text-gray-600 mb-4">
                No public cards match &ldquo;{searchQuery}&rdquo;
              </p>
              <div className="bg-white border border-gray-300 rounded-lg p-4 max-w-md mx-auto text-left">
                <p className="text-sm text-gray-700 mb-2"><strong>Tips:</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Try a partial serial number</li>
                  <li>• Check for typos</li>
                  <li>• Only public cards are searchable</li>
                  <li>• Private cards won&apos;t appear in results</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((card) => (
                <Link
                  key={card.id}
                  href={getCardLink(card)}
                  className="block bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 hover:shadow-lg transition-all"
                >
                  {/* Card Image */}
                  <div className="relative aspect-[3/4] bg-gray-100">
                    {card.front_url ? (
                      <Image
                        src={card.front_url}
                        alt={card.player_name || 'Card'}
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        No Image
                      </div>
                    )}
                  </div>

                  {/* Card Info */}
                  <div className="p-4">
                    {/* Player Name */}
                    <h3 className="font-bold text-lg text-gray-900 mb-1 truncate">
                      {card.player_name || 'Unknown'}
                    </h3>

                    {/* Card Details */}
                    <p className="text-sm text-gray-600 mb-2 truncate">
                      {card.year} {card.manufacturer} {card.set_name}
                      {card.subset && ` - ${card.subset}`}
                    </p>

                    {/* Grade */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="bg-purple-100 px-3 py-1 rounded-lg">
                        <p className="text-xs text-purple-700 font-semibold">DCM GRADE</p>
                        <p className="text-2xl font-bold text-purple-900">
                          {getGrade(card)?.toFixed(1) || 'N/A'}
                        </p>
                      </div>
                      <div className="bg-green-100 px-3 py-1 rounded-lg">
                        <p className="text-xs text-green-700 font-semibold">🌐 PUBLIC</p>
                      </div>
                    </div>

                    {/* Serial Number */}
                    <div className="bg-gray-50 rounded px-2 py-1">
                      <p className="text-xs text-gray-500">Serial</p>
                      <p className="text-sm font-mono font-semibold text-gray-800 truncate">
                        {card.serial}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Help Section */}
      {!hasSearched && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8">
          <h2 className="text-xl font-bold text-blue-900 mb-4">How to Search</h2>
          <div className="grid md:grid-cols-2 gap-6 text-blue-800">
            <div>
              <h3 className="font-semibold mb-2">🔍 Search by Serial Number</h3>
              <p className="text-sm">
                Enter the full or partial serial number of a card. For example: DCM-2024-001234
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">🌐 Public Cards Only</h3>
              <p className="text-sm">
                Only cards marked as &quot;public&quot; by their owners will appear in search results.
                Private cards are not searchable.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">👤 View Card Details</h3>
              <p className="text-sm">
                Click on any card in the results to view its full grading details, images, and analysis.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">🔗 Share Links</h3>
              <p className="text-sm">
                Public cards can be shared via their URL. Anyone with the link can view public cards.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap in Suspense for Next.js 15 useSearchParams() requirement
export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading search...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
