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
  // Special features
  rookie_or_first?: boolean;
  autographed?: boolean;
  serial_number?: string;
  facsimile_autograph?: boolean;
  official_reprint?: boolean;
  // MTG-specific features
  is_foil?: boolean;
  foil_type?: string;
  is_double_faced?: boolean;
  mtg_rarity?: string;
}

// Helper: Format grade for display
const formatGrade = (grade: number | null | undefined): string => {
  if (grade === null || grade === undefined || grade === 0) return 'N/A';
  // Show .5 scores with decimal, whole numbers without
  if (grade % 1 === 0.5) return grade.toFixed(1);
  return Math.round(grade).toString();
};

// Helper: Get condition label from grade
const getConditionFromGrade = (grade: number): string => {
  if (grade >= 10) return 'Gem Mint';
  if (grade >= 9) return 'Mint';
  if (grade >= 8) return 'Near Mint';
  if (grade >= 7) return 'Excellent';
  if (grade >= 6) return 'Very Good';
  if (grade >= 5) return 'Good';
  if (grade >= 4) return 'Fair';
  return 'Poor';
};

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

  // Helper to get display name based on card category
  const getDisplayName = (card: CardResult) => {
    const category = card.category || card.sport_type;
    const sportCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];
    const isSportsCard = category && sportCategories.includes(category);
    const isOtherCard = category === 'Other';

    // Sports and Other cards prioritize player_name (which is player_or_character from API)
    // TCG cards prioritize card_name
    return (isSportsCard || isOtherCard)
      ? (card.player_name || 'Unknown')
      : (card.player_name || 'Unknown Card');
  };

  // Helper to build set line text
  const getSetLineText = (card: CardResult) => {
    const parts = [card.set_name, card.year].filter(p => p && p !== 'null');
    return parts.join(' • ') || 'Unknown Set';
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Search Graded Cards</h1>
        <p className="text-gray-600">Search for publicly shared cards by serial number</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter serial number (e.g., 460268)"
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-lg"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-8 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-8">
          <p className="text-red-800 font-semibold">{error}</p>
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
              {results.map((card) => {
                const displayName = getDisplayName(card);
                const setLineText = getSetLineText(card);
                const grade = getGrade(card);
                const condition = grade ? getConditionFromGrade(grade) : '';

                // Build special features array
                const features: string[] = [];
                // MTG-specific features (no emojis)
                if (card.is_foil) features.push(card.foil_type || 'Foil');
                if (card.mtg_rarity) {
                  const rarity = card.mtg_rarity === 'mythic' ? 'Mythic' :
                                card.mtg_rarity.charAt(0).toUpperCase() + card.mtg_rarity.slice(1);
                  features.push(rarity);
                }
                if (card.is_double_faced) features.push('Double-Faced');
                // Standard features
                if (card.rookie_or_first === true || card.rookie_or_first === 'true') features.push('RC');
                if (card.autographed) features.push('Auto');
                if (card.facsimile_autograph) features.push('Facsimile');
                if (card.official_reprint) features.push('Reprint');
                if (card.serial_number && card.serial_number !== 'N/A' && !card.serial_number.toLowerCase().includes('not present') && !card.serial_number.toLowerCase().includes('none')) {
                  features.push(card.serial_number);
                }

                // Calculate scale for name to fit on single line
                const nameScaleX = displayName.length > 25
                  ? Math.max(0.6, 25 / displayName.length)
                  : 1;

                // Calculate font size for set line
                const setFontSize = setLineText.length > 50 ? '8px'
                  : setLineText.length > 40 ? '9px'
                  : setLineText.length > 30 ? '10px'
                  : '11px';

                return (
                  <div key={card.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
                    {/* Professional Label (PSA-Style) - ABOVE IMAGE */}
                    <div className="bg-gradient-to-b from-gray-50 to-white border-2 border-purple-600 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-1.5">
                        {/* Left: DCM Logo */}
                        <div className="flex-shrink-0 -ml-1">
                          <img
                            src="/DCM-logo.png"
                            alt="DCM"
                            className="h-9 w-auto"
                          />
                        </div>

                        {/* Center: Card Information - 4-Line Structure */}
                        <div className="flex-1 min-w-0 mx-1 flex flex-col justify-center gap-0.5">
                          {/* Line 1: Player/Card Name - Scale to fit on single line */}
                          <div
                            className="font-bold text-gray-900 leading-tight whitespace-nowrap origin-left"
                            style={{
                              fontSize: '13px',
                              transform: `scaleX(${nameScaleX})`,
                              lineHeight: '1.2'
                            }}
                            title={displayName}
                          >
                            {displayName}
                          </div>

                          {/* Line 2: Set Name • Year */}
                          <div
                            className="text-gray-700 leading-tight"
                            style={{
                              fontSize: setFontSize,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              wordBreak: 'break-word'
                            }}
                            title={setLineText}
                          >
                            {setLineText}
                          </div>

                          {/* Line 3: Special Features (RC, Auto, Facsimile, Reprint, Serial #) - Only if present */}
                          {features.length > 0 && (
                            <div className="text-blue-600 font-semibold text-[10px] leading-tight truncate">
                              {features.join(' • ')}
                            </div>
                          )}

                          {/* Line 4: DCM Serial Number */}
                          <div className="text-gray-500 font-mono truncate text-[10px] leading-tight">
                            {card.serial}
                          </div>
                        </div>

                        {/* Right: Grade Display */}
                        <div className="text-center flex-shrink-0">
                          <div className="font-bold text-purple-700 text-3xl leading-none">
                            {grade ? formatGrade(grade) : 'N/A'}
                          </div>
                          {condition && (
                            <>
                              <div className="border-t-2 border-purple-600 w-8 mx-auto my-1"></div>
                              <div className="font-semibold text-purple-600 text-[0.65rem] leading-tight">
                                {condition}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Image */}
                    <div className="aspect-[3/4] relative bg-gray-100">
                      {card.front_url ? (
                        <Image
                          src={card.front_url}
                          alt={displayName}
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

                    {/* View Details Button */}
                    <div className="p-3">
                      <Link
                        href={getCardLink(card)}
                        className="inline-block w-full text-center bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Help Section */}
      {!hasSearched && (
        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-8">
          <h2 className="text-xl font-bold text-purple-900 mb-4">How to Search</h2>
          <div className="grid md:grid-cols-2 gap-6 text-purple-800">
            <div>
              <h3 className="font-semibold mb-2">Search by Serial Number</h3>
              <p className="text-sm">
                Enter the full or partial serial number of a card. For example: 460268
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Public Cards Only</h3>
              <p className="text-sm">
                Only cards marked as &quot;public&quot; by their owners will appear in search results.
                Private cards are not searchable.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">View Card Details</h3>
              <p className="text-sm">
                Click on any card in the results to view its full grading details, images, and analysis.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Share Links</h3>
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
