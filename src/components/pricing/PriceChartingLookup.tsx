'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getStoredSession } from '@/lib/directAuth';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface NormalizedPrices {
  raw: number | null;
  psa: Record<string, number>;
  bgs: Record<string, number>;
  sgc: Record<string, number>;
  estimatedDcm: number | null;
  productId: string;
  productName: string;
  setName: string;
  lastUpdated: string;
  salesVolume: string | null;
  // Fallback pricing info
  isFallback?: boolean;
  exactMatchName?: string;
}

interface AvailableParallel {
  id: string;
  name: string;
  setName: string;
  hasPrice: boolean;
}

interface PriceChartingResult {
  success: boolean;
  data?: {
    prices: NormalizedPrices;
    estimatedValue: number | null;
    matchConfidence: 'high' | 'medium' | 'low' | 'none';
    queryUsed: string;
    availableParallels?: AvailableParallel[];
  };
  error?: string;
  cached?: boolean;    // Whether data came from cache
  cacheAge?: number;   // Age of cache in days
}

interface PriceChartingLookupProps {
  card: {
    id?: string;  // Card ID for saving manual selection
    player_or_character?: string;
    year?: string;
    set_name?: string;
    card_number?: string;
    rarity_or_variant?: string;
    subset?: string;  // Insert/subset name (e.g., "Downtown", "Kaboom") - NOT used for variant search
    subset_insert_name?: string;  // Alternative field from v3.3 rarity classification
    parallel_type?: string;  // Actual parallel color (e.g., "Green", "Gold", "Silver Prizm") - USE THIS for variant
    rookie_or_first?: boolean;
    category?: string;  // e.g., "Hockey", "Baseball", "Basketball", "Football"
    serial_numbering?: string;  // e.g., "23/75" or "/99"
    // Saved manual selection
    dcm_selected_product_id?: string;
    dcm_selected_product_name?: string;
  };
  dcmGrade?: number;
  isOwner?: boolean;  // Whether the current user owns this card
  onPriceLoad?: (data: {
    estimatedValue: number | null;
    matchConfidence: 'high' | 'medium' | 'low' | 'none';
    productName: string | null;
    sportsCardsProUrl?: string;
  }) => void;  // Callback when price data is loaded
}

interface ChartDataPoint {
  grade: string;
  gradeNum: number;
  price: number;
  label: string;
}

// Custom tooltip for the chart
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ChartDataPoint;
    return (
      <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-semibold text-gray-800">{data.label}</p>
        <p className="text-lg font-bold text-emerald-600">
          ${data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

export function PriceChartingLookup({ card, dcmGrade, isOwner = false, onPriceLoad }: PriceChartingLookupProps) {
  const [priceData, setPriceData] = useState<PriceChartingResult['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllGrades, setShowAllGrades] = useState(false);
  const [showChart, setShowChart] = useState(true);

  // Parallel selection state
  const [availableParallels, setAvailableParallels] = useState<AvailableParallel[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(card.dcm_selected_product_id || null);
  const [isManualSelection, setIsManualSelection] = useState<boolean>(!!card.dcm_selected_product_id);
  const [showParallelSelector, setShowParallelSelector] = useState(false);
  const [loadingParallels, setLoadingParallels] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);

  // Cache status
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState<number | null>(null);

  // Non-owner notification
  const [showOwnerNote, setShowOwnerNote] = useState(false);

  const fetchPrices = async (overrideProductId?: string, forceRefresh: boolean = false) => {
    if (!card.player_or_character) {
      return;
    }

    setLoading(true);
    setError(null);
    setIsCached(false);
    setCacheAge(null);

    // Check if we should use a saved or selected product
    const productIdToUse = overrideProductId || selectedProductId;

    // If using manual selection, fetch that specific product
    if (productIdToUse) {
      console.log('[PriceChartingLookup] === FETCHING MANUAL SELECTION ===');
      console.log('[PriceChartingLookup] Product ID:', productIdToUse);
      console.log('[PriceChartingLookup] Force refresh:', forceRefresh);
      try {
        const response = await fetch('/api/pricing/pricecharting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedProductId: productIdToUse,
            dcmGrade,
            cardId: card.id,      // For caching
            forceRefresh,         // Bypass cache if true
          }),
        });

        const data: PriceChartingResult = await response.json();
        console.log('[PriceChartingLookup] API Response:', data);

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch prices');
        }

        console.log('[PriceChartingLookup] Setting priceData with:', {
          productId: data.data?.prices?.productId,
          productName: data.data?.prices?.productName,
          raw: data.data?.prices?.raw,
          psa: data.data?.prices?.psa,
          cached: data.cached,
        });

        setPriceData(data.data);
        setIsManualSelection(true);
        setIsCached(data.cached || false);
        setCacheAge(data.cacheAge || null);

        // Notify parent of price data
        if (onPriceLoad && data.data) {
          // Generate SportsCardsPro URL from the data
          const slugify = (str: string) => str
            .toLowerCase()
            .replace(/[#]/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .trim();
          const setSlug = slugify(data.data.prices?.setName || '');
          const productSlug = slugify(data.data.prices?.productName || '');
          const sportsCardsProUrl = (setSlug && productSlug)
            ? `https://www.sportscardspro.com/game/${setSlug}/${productSlug}`
            : `https://www.sportscardspro.com/search?q=${encodeURIComponent(data.data.queryUsed || card.player_or_character || '')}`;

          onPriceLoad({
            estimatedValue: data.data.estimatedValue,
            matchConfidence: data.data.matchConfidence,
            productName: data.data.prices?.productName || null,
            sportsCardsProUrl,
          });
        }
      } catch (err) {
        console.error('[PriceChartingLookup] Error fetching selected product:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch prices');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Determine the best variant value to use
    // Use parallel_type (actual color like "Green", "Gold") - NOT subset (insert name like "Downtown")
    // Filter out card types that aren't parallel colors
    const genericTypes = [
      'base', 'insert', 'modern_parallel', 'parallel', 'parallel_variant', 'sp', 'ssp',
      'autographed', 'autograph', 'auto', 'rookie', 'rc', 'memorabilia', 'relic', 'patch'
    ];

    // Priority: parallel_type > rarity_or_variant (if not generic)
    // Do NOT use subset - it's the insert/subset name, not a parallel color
    const variant = card.parallel_type && !genericTypes.includes(card.parallel_type.toLowerCase())
      ? card.parallel_type
      : (card.rarity_or_variant && !genericTypes.includes(card.rarity_or_variant.toLowerCase())
          ? card.rarity_or_variant
          : undefined);

    // Log the search parameters clearly
    console.log('[PriceChartingLookup] === SEARCH ===');
    console.log('[PriceChartingLookup] Player:', card.player_or_character);
    console.log('[PriceChartingLookup] Year:', card.year);
    console.log('[PriceChartingLookup] Set:', card.set_name);
    console.log('[PriceChartingLookup] Card #:', card.card_number);
    console.log('[PriceChartingLookup] Serial:', card.serial_numbering || '(none)');
    console.log('[PriceChartingLookup] Parallel Type:', card.parallel_type || '(none)');
    console.log('[PriceChartingLookup] Subset (NOT used):', card.subset || '(none)');
    console.log('[PriceChartingLookup] Rarity/Variant:', card.rarity_or_variant || '(none)');
    console.log('[PriceChartingLookup] VARIANT USED:', variant || '(none)');

    try {
      console.log('[PriceChartingLookup] Force refresh:', forceRefresh);
      const response = await fetch('/api/pricing/pricecharting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: card.player_or_character,
          year: card.year,
          setName: card.set_name,
          cardNumber: card.card_number,
          variant,
          rookie: card.rookie_or_first,
          sport: card.category,
          serialNumbering: card.serial_numbering,
          dcmGrade,
          includeParallels: true,  // Request available parallels
          cardId: card.id,         // For caching
          forceRefresh,            // Bypass cache if true
        }),
      });

      const data: PriceChartingResult = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch prices');
      }

      setPriceData(data.data);
      setIsManualSelection(false);
      setIsCached(data.cached || false);
      setCacheAge(data.cacheAge || null);

      // Notify parent of price data
      if (onPriceLoad && data.data) {
        // Generate SportsCardsPro URL from the data
        const slugify = (str: string) => str
          .toLowerCase()
          .replace(/[#]/g, '')
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .trim();
        const setSlug = slugify(data.data.prices?.setName || '');
        const productSlug = slugify(data.data.prices?.productName || '');
        const sportsCardsProUrl = (setSlug && productSlug)
          ? `https://www.sportscardspro.com/game/${setSlug}/${productSlug}`
          : `https://www.sportscardspro.com/search?q=${encodeURIComponent(data.data.queryUsed || card.player_or_character || '')}`;

        onPriceLoad({
          estimatedValue: data.data.estimatedValue,
          matchConfidence: data.data.matchConfidence,
          productName: data.data.prices?.productName || null,
          sportsCardsProUrl,
        });
      }

      // Store available parallels for selection dropdown
      if (data.data?.availableParallels) {
        setAvailableParallels(data.data.availableParallels);
      }

      if (data.cached) {
        console.log(`[PriceChartingLookup] Using cached data (${data.cacheAge} days old)`);
      }
    } catch (err) {
      console.error('[PriceChartingLookup] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
    } finally {
      setLoading(false);
    }
  };

  // Fetch available parallels for the selector dropdown
  const fetchParallels = async () => {
    if (!card.player_or_character || availableParallels.length > 0) {
      setShowParallelSelector(true);
      return;
    }

    setLoadingParallels(true);
    try {
      const response = await fetch('/api/pricing/pricecharting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: card.player_or_character,
          year: card.year,
          setName: card.set_name,
          cardNumber: card.card_number,
          includeParallels: true,
        }),
      });

      const data: PriceChartingResult = await response.json();
      if (data.data?.availableParallels) {
        setAvailableParallels(data.data.availableParallels);
      }
      setShowParallelSelector(true);
    } catch (err) {
      console.error('[PriceChartingLookup] Error fetching parallels:', err);
    } finally {
      setLoadingParallels(false);
    }
  };

  // Save manual selection to database
  const saveSelection = async (productId: string, productName: string) => {
    if (!card.id) {
      console.log('[PriceChartingLookup] No card ID, cannot save selection');
      return;
    }

    const session = getStoredSession();
    if (!session?.access_token) {
      console.log('[PriceChartingLookup] No auth session, cannot save selection');
      return;
    }

    setSavingSelection(true);
    try {
      const response = await fetch('/api/pricing/dcm-select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          cardId: card.id,
          productId,
          productName,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save selection');
      }

      console.log('[PriceChartingLookup] Selection saved successfully');
    } catch (err) {
      console.error('[PriceChartingLookup] Error saving selection:', err);
    } finally {
      setSavingSelection(false);
    }
  };

  // Clear manual selection and return to auto-match
  const clearSelection = async () => {
    console.log('[PriceChartingLookup] === CLEAR SELECTION CLICKED ===');
    console.log('[PriceChartingLookup] card.id:', card.id);

    if (!card.id) {
      console.log('[PriceChartingLookup] No card.id, clearing local state only');
      // Still reset local state even without card.id
      setSelectedProductId(null);
      setIsManualSelection(false);
      setShowParallelSelector(false);
      setLoading(true);
      await fetchPrices(undefined, true);  // Force refresh for new auto-match
      return;
    }

    const session = getStoredSession();
    console.log('[PriceChartingLookup] Has session:', !!session?.access_token);

    if (!session?.access_token) {
      console.log('[PriceChartingLookup] No auth session, clearing local state only');
      // Still reset local state even without auth
      setSelectedProductId(null);
      setIsManualSelection(false);
      setShowParallelSelector(false);
      setLoading(true);
      await fetchPrices(undefined, true);  // Force refresh for new auto-match
      return;
    }

    setSavingSelection(true);
    try {
      console.log('[PriceChartingLookup] Calling DELETE API...');
      const response = await fetch(`/api/pricing/dcm-select?cardId=${card.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      console.log('[PriceChartingLookup] DELETE API response:', data);

      if (!data.success) {
        throw new Error(data.error || 'Failed to clear selection');
      }

      // Reset to auto-match
      console.log('[PriceChartingLookup] Resetting to auto-match...');
      setSelectedProductId(null);
      setIsManualSelection(false);
      setShowParallelSelector(false);
      setLoading(true);
      await fetchPrices(undefined, true); // Re-fetch with auto-match, force refresh
      console.log('[PriceChartingLookup] Auto-match fetch complete');
    } catch (err) {
      console.error('[PriceChartingLookup] Error clearing selection:', err);
    } finally {
      setSavingSelection(false);
    }
  };

  // Handle parallel selection from dropdown
  const handleParallelSelect = async (productId: string) => {
    console.log('[PriceChartingLookup] handleParallelSelect CALLED with:', productId);

    const selected = availableParallels.find(p => p.id === productId);
    if (!selected) {
      console.error('[PriceChartingLookup] Selected parallel not found:', productId);
      return;
    }

    console.log('[PriceChartingLookup] === PARALLEL SELECTED ===');
    console.log('[PriceChartingLookup] Product ID:', productId);
    console.log('[PriceChartingLookup] Product Name:', selected.name);
    console.log('[PriceChartingLookup] Set Name:', selected.setName);

    // Close dropdown and show loading
    setSelectedProductId(productId);
    setShowParallelSelector(false);
    setLoading(true);

    // Fetch prices for selected product
    console.log('[PriceChartingLookup] Fetching prices for selected product...');
    await fetchPrices(productId);
    console.log('[PriceChartingLookup] Fetch complete, priceData should be updated');

    // Save to database if we have a card ID
    if (card.id) {
      console.log('[PriceChartingLookup] Saving selection to database...');
      await saveSelection(productId, selected.name);
      console.log('[PriceChartingLookup] Selection saved');
    }
  };

  useEffect(() => {
    if (card.player_or_character) {
      // If card has a saved selection, use it
      if (card.dcm_selected_product_id) {
        setSelectedProductId(card.dcm_selected_product_id);
        setIsManualSelection(true);
        fetchPrices(card.dcm_selected_product_id);
      } else {
        fetchPrices();
      }
    }
    // Re-fetch when subset/parallel changes (e.g., user updates card info)
  }, [card.player_or_character, card.year, card.set_name, card.subset, card.subset_insert_name, card.rarity_or_variant, dcmGrade, card.dcm_selected_product_id]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-orange-100 text-orange-700',
      none: 'bg-red-100 text-red-700',
    };
    return colors[confidence as keyof typeof colors] || colors.low;
  };

  // Build chart data from prices - shows market prices by grade
  // Uses the highest price available across all grading companies for each grade
  // Sorted by price ascending (lowest at top, highest at bottom)
  const getChartData = (dcmEstimateValue?: number | null): ChartDataPoint[] => {
    if (!priceData?.prices) return [];

    const data: ChartDataPoint[] = [];

    // Add raw price
    if (priceData.prices.raw && priceData.prices.raw > 0) {
      data.push({
        grade: 'Raw',
        gradeNum: 0,
        price: priceData.prices.raw,
        label: 'Raw (Ungraded)',
      });
    }

    // Add DCM estimate if available
    if (dcmEstimateValue && dcmEstimateValue > 0 && dcmGrade) {
      data.push({
        grade: 'DCM',
        gradeNum: dcmGrade,
        price: dcmEstimateValue,
        label: `DCM ${Math.round(dcmGrade)}`,
      });
    }

    // For each grade, use the highest price across all grading companies
    const grades = ['7', '8', '9', '9.5', '10'];
    for (const grade of grades) {
      const prices: number[] = [];

      // Collect prices from all grading companies for this grade
      if (priceData.prices.psa[grade] && priceData.prices.psa[grade] > 0) {
        prices.push(priceData.prices.psa[grade]);
      }
      if (priceData.prices.bgs[grade] && priceData.prices.bgs[grade] > 0) {
        prices.push(priceData.prices.bgs[grade]);
      }
      if (priceData.prices.sgc[grade] && priceData.prices.sgc[grade] > 0) {
        prices.push(priceData.prices.sgc[grade]);
      }

      if (prices.length > 0) {
        const highestPrice = Math.max(...prices);
        const gradeNum = parseFloat(grade);
        data.push({
          grade: grade,
          gradeNum: gradeNum,
          price: highestPrice,
          label: `Grade ${grade}`,
        });
      }
    }

    // Sort by price ascending (lowest at top, highest at bottom)
    data.sort((a, b) => a.price - b.price);

    return data;
  };

  // Get PSA grades that have prices
  const getPsaGradesWithPrices = () => {
    if (!priceData?.prices.psa) return [];
    return Object.entries(priceData.prices.psa)
      .filter(([_, price]) => price > 0)
      .sort(([a], [b]) => Number(b) - Number(a)); // Sort descending
  };

  // Get relevant grades to display based on DCM grade
  const getRelevantGrades = () => {
    const allGrades = getPsaGradesWithPrices();
    if (showAllGrades || !dcmGrade) return allGrades;

    // Show grades around the DCM grade
    const dcmRounded = Math.round(dcmGrade);
    return allGrades.filter(([grade]) => {
      const gradeNum = Number(grade);
      return gradeNum >= dcmRounded - 1 && gradeNum <= dcmRounded + 1;
    });
  };

  // Generate SportsCardsPro URL from set name and product name
  const getSportsCardsProUrl = () => {
    if (!priceData) return 'https://www.sportscardspro.com';

    // Slugify: lowercase, replace spaces with hyphens, remove special chars
    const slugify = (str: string) => str
      .toLowerCase()
      .replace(/[#]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .trim();

    const setSlug = slugify(priceData.prices.setName || '');
    const productSlug = slugify(priceData.prices.productName || '');

    if (setSlug && productSlug) {
      return `https://www.sportscardspro.com/game/${setSlug}/${productSlug}`;
    }

    // Fallback to search
    return `https://www.sportscardspro.com/search?q=${encodeURIComponent(priceData.queryUsed || card.player_or_character || '')}`;
  };

  // Calculate price increase from raw to PSA 10
  const getPriceIncrease = () => {
    if (!priceData?.prices) return null;
    const raw = priceData.prices.raw;
    const psa10 = priceData.prices.psa['10'];
    if (!raw || !psa10 || raw === 0) return null;
    return ((psa10 - raw) / raw * 100).toFixed(0);
  };

  // Get market range - Low, Median, Average, High across ALL available prices (raw and graded)
  const getMarketRange = () => {
    if (!priceData?.prices) return null;
    const raw = priceData.prices.raw;

    // Collect ALL available prices (raw + graded from all companies)
    const allPrices: number[] = [];

    // Add raw price
    if (raw && raw > 0) allPrices.push(raw);

    // Add graded prices from PSA
    Object.values(priceData.prices.psa).forEach(price => {
      if (price && price > 0) allPrices.push(price);
    });

    // Add graded prices from BGS
    Object.values(priceData.prices.bgs).forEach(price => {
      if (price && price > 0) allPrices.push(price);
    });

    // Add graded prices from SGC
    Object.values(priceData.prices.sgc).forEach(price => {
      if (price && price > 0) allPrices.push(price);
    });

    if (allPrices.length === 0) return null;

    // Sort all prices
    const sortedPrices = [...allPrices].sort((a, b) => a - b);

    // Low is the minimum price (could be raw or graded)
    const low = sortedPrices[0];

    // High is the maximum price (could be raw or graded)
    const high = sortedPrices[sortedPrices.length - 1];

    // Calculate median (middle value when sorted)
    const mid = Math.floor(sortedPrices.length / 2);
    const median = sortedPrices.length % 2 !== 0
      ? sortedPrices[mid]
      : (sortedPrices[mid - 1] + sortedPrices[mid]) / 2;

    // Calculate average
    const average = allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length;

    return {
      low: Math.round(low * 100) / 100,
      high: Math.round(high * 100) / 100,
      median: Math.round(median * 100) / 100,
      average: Math.round(average * 100) / 100,
      salesVolume: priceData.prices.salesVolume,
    };
  };

  // Calculate DCM estimated value using a multiplier approach
  // DCM is newer and not yet established like PSA, so values are typically
  // a percentage between raw and PSA equivalent grade
  const getDcmEstimatedValue = () => {
    if (!priceData?.prices || !dcmGrade) return null;

    const raw = priceData.prices.raw;
    const psaGrades = priceData.prices.psa;

    // Get the PSA price at equivalent grade (for reference only)
    const roundedGrade = Math.round(dcmGrade).toString();
    const halfGrade = dcmGrade >= 9 ? '9.5' : null;
    const psaEquivalentPrice = psaGrades[roundedGrade] || (halfGrade && psaGrades[halfGrade]) || null;

    // Fallback: if no graded equivalent, use raw × 3
    if (!psaEquivalentPrice && raw) {
      return {
        value: Math.round(raw * 3 * 100) / 100,
        multiplier: null, // Indicates fallback method was used
        rawPrice: raw,
        psaPrice: null,
      };
    }

    if (!raw || !psaEquivalentPrice) return null;

    // DCM multiplier: represents market premium over raw
    // Higher grades get closer to PSA values, lower grades closer to raw
    // This is a conservative estimate since DCM is establishing market presence
    let dcmMultiplier: number;
    if (dcmGrade >= 9.5) {
      dcmMultiplier = 0.70; // 70% of PSA premium over raw
    } else if (dcmGrade >= 9) {
      dcmMultiplier = 0.65; // 65% of PSA premium
    } else if (dcmGrade >= 8) {
      dcmMultiplier = 0.55; // 55% of PSA premium
    } else if (dcmGrade >= 7) {
      dcmMultiplier = 0.45; // 45% of PSA premium
    } else {
      dcmMultiplier = 0.35; // 35% of PSA premium for lower grades
    }

    // Calculate: Raw + (PSA premium × DCM multiplier)
    const psaPremium = psaEquivalentPrice - raw;
    const dcmValue = raw + (psaPremium * dcmMultiplier);

    return {
      value: Math.round(dcmValue * 100) / 100,
      multiplier: dcmMultiplier,
      rawPrice: raw,
      psaPrice: psaEquivalentPrice,
    };
  };

  // Get highest price across all grading companies for the chart
  const getHighestGradedPrice = () => {
    if (!priceData?.prices) return null;

    const allPrices: number[] = [];

    // Collect all graded prices from all companies
    Object.values(priceData.prices.psa).forEach(p => p > 0 && allPrices.push(p));
    Object.values(priceData.prices.bgs).forEach(p => p > 0 && allPrices.push(p));
    Object.values(priceData.prices.sgc).forEach(p => p > 0 && allPrices.push(p));

    return allPrices.length > 0 ? Math.max(...allPrices) : null;
  };

  if (!card.player_or_character) {
    return null;
  }

  const priceIncrease = getPriceIncrease();
  const marketRange = getMarketRange();
  const dcmEstimate = getDcmEstimatedValue();
  const chartData = getChartData(dcmEstimate?.value);

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-200 p-4 sm:p-6 shadow-lg">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-gray-800">Market Value</h3>
            <p className="text-xs sm:text-sm text-gray-500">
              Based on actual sold prices
              {isCached && cacheAge !== null && (
                <span className="ml-1 text-gray-400">
                  · Updated {cacheAge < 1 ? 'today' : `${Math.round(cacheAge)}d ago`}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchPrices(undefined, true)}
          disabled={loading}
          className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          title={isCached ? 'Click to fetch fresh prices from SportsCardsPro' : 'Refresh prices'}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700">
            {error === 'No matching products found'
              ? 'No pricing data found for this card. Try adjusting the search or check that the card details are correct.'
              : error.includes('timeout') || error.includes('API error')
              ? 'Price service temporarily unavailable. Click Refresh to try again.'
              : error}
          </p>
        </div>
      )}

      {loading && !priceData && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <span className="ml-3 text-gray-600">Searching price database...</span>
        </div>
      )}

      {priceData && (
        <>
          {/* Matched Card Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">Matched Card</h4>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceBadge(priceData.matchConfidence)}`}>
                {isManualSelection ? 'Manual Selection' :
                 priceData.matchConfidence === 'high' ? 'Best Match' :
                 priceData.matchConfidence === 'medium' ? 'Good Match' :
                 priceData.matchConfidence === 'low' ? 'Partial Match' : 'No Match'}
              </span>
            </div>

            {/* Card details in labeled format */}
            <div className="space-y-2">
              <div className="flex">
                <span className="text-xs text-gray-500 w-16 flex-shrink-0">Card:</span>
                <span className="text-sm font-medium text-gray-800">{priceData.prices.productName}</span>
              </div>
              {priceData.prices.setName && (
                <div className="flex">
                  <span className="text-xs text-gray-500 w-16 flex-shrink-0">Set:</span>
                  <span className="text-sm text-gray-700">{priceData.prices.setName}</span>
                </div>
              )}
            </div>

            {/* Expandable section for other variations */}
            <details className="mt-4 border-t border-gray-100 pt-3 group">
              <summary className="text-xs text-emerald-600 cursor-pointer hover:text-emerald-800 font-medium flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden">
                <svg className="w-3 h-3 transition-transform duration-200 group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                See other card variations, parallels and closely matched cards
              </summary>

              <div className="mt-3">
                {/* Reset to auto-match option */}
                {isManualSelection && (
                  <button
                    onClick={clearSelection}
                    disabled={savingSelection}
                    className="w-full text-left px-3 py-2 mb-2 rounded text-sm bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">↩ Reset to auto-match</span>
                      {savingSelection && <span className="text-xs">Resetting...</span>}
                    </div>
                    <p className="text-xs text-amber-600 mt-0.5">Let the system find the best matching card</p>
                  </button>
                )}

                {/* Load parallels button or list */}
                {availableParallels.length === 0 ? (
                  <button
                    onClick={fetchParallels}
                    disabled={loadingParallels}
                    className="w-full text-center px-3 py-2 rounded text-sm bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors"
                  >
                    {loadingParallels ? 'Loading variations...' : 'Load available variations'}
                  </button>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-2">
                      {isOwner ? 'Select a different variation to update pricing:' : 'Available variations for this card:'}
                    </p>

                    {/* Non-owner notification */}
                    {showOwnerNote && (
                      <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 animate-in fade-in duration-200">
                        <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-xs text-amber-800 font-medium">Only the card owner can update pricing</p>
                          <p className="text-xs text-amber-600 mt-0.5">Sign in as the owner to select a different parallel.</p>
                        </div>
                        <button
                          onClick={() => setShowOwnerNote(false)}
                          className="text-amber-400 hover:text-amber-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}

                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {availableParallels.map((parallel) => {
                        // Extract serial number from product name (e.g., "/25", "/99", "/8")
                        // Match /digits anywhere in the name, not just at the end
                        const serialMatch = parallel.name.match(/\s*(\/\d+)/);
                        const serialNumber = serialMatch ? serialMatch[1] : null;
                        const nameWithoutSerial = serialNumber
                          ? parallel.name.replace(/\s*\/\d+/, '').trim()
                          : parallel.name;

                        return (
                          <button
                            key={parallel.id}
                            onClick={() => {
                              if (!isOwner) {
                                setShowOwnerNote(true);
                                return;
                              }
                              handleParallelSelect(parallel.id);
                            }}
                            disabled={savingSelection}
                            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                              parallel.id === priceData.prices.productId
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : parallel.hasPrice
                                ? 'bg-gray-50 hover:bg-emerald-50 text-gray-700 border border-transparent'
                                : 'bg-gray-50 text-gray-400 border border-transparent'
                            } ${!isOwner && parallel.id !== priceData.prices.productId ? 'cursor-not-allowed opacity-75' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 truncate">
                                <span className="truncate font-medium">{nameWithoutSerial}</span>
                                {serialNumber && (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded flex-shrink-0">
                                    {serialNumber}
                                  </span>
                                )}
                              </div>
                              <span className={`text-xs flex-shrink-0 ml-2 ${parallel.hasPrice ? 'text-green-600' : 'text-gray-400'}`}>
                                {parallel.id === priceData.prices.productId ? '✓ Current' : parallel.hasPrice ? 'Has prices' : 'No prices'}
                              </span>
                            </div>
                          {parallel.setName && (
                            <span className="text-xs text-gray-500 truncate block mt-0.5">
                              {parallel.setName}
                            </span>
                          )}
                        </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </details>
          </div>


          {/* Fallback pricing notice - when using pricing from a similar card */}
          {priceData.prices.isFallback && priceData.prices.exactMatchName && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-purple-800">Using Similar Card Pricing</p>
                  <p className="text-xs text-purple-700 mt-1">
                    Your exact card (<span className="font-medium">{priceData.prices.exactMatchName}</span>) doesn't have enough sales data yet.
                    Showing pricing from a similar parallel as a reference.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* DCM Estimated Value - Prominent display at top */}
          {dcmEstimate && dcmGrade && (
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 mb-4 shadow-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* DCM Grade Badge - Purple pill style with logo */}
                  <div className="bg-violet-600 px-4 py-2 rounded-full shadow-lg border-2 border-violet-400/50">
                    <div className="flex items-center gap-2">
                      <Image
                        src="/DCM Logo white.png"
                        alt="DCM"
                        width={32}
                        height={32}
                        className="h-6 w-auto"
                      />
                      <span className="text-white text-2xl font-bold">{Math.round(dcmGrade)}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-white font-semibold">Your Grade</p>
                    <p className="text-xs text-white/60">Estimated Value Below</p>
                  </div>
                </div>
              </div>
              <p className="text-4xl font-bold mb-3">{formatPrice(dcmEstimate.value)}</p>
              <p className="text-xs text-white/70 leading-relaxed">
                DCM value is estimated conservatively based on live sold pricing for both raw and graded cards. Actual sale prices may vary.
              </p>
            </div>
          )}

          {/* Warning if serial numbered card - price is approximate */}
          {card.serial_numbering && marketRange && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3 text-xs text-amber-700">
              <strong>Note:</strong> Your card is numbered ({card.serial_numbering}). Price shown is for a similar parallel - actual value may vary.
            </div>
          )}

          {/* Message when card is found but no pricing data available yet */}
          {priceData.matchConfidence === 'low' && !marketRange && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800 mb-1">Limited Pricing Data Available</p>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    We found this card in our database, but there isn't enough sales history yet to provide accurate market pricing.
                    This often happens with newer releases or limited print runs. Check back later as more sales data becomes available.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Market Price Range - 4-box grid layout like eBay */}
          {marketRange && (marketRange.low || marketRange.high) && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Market Price Range</h4>
                {marketRange.salesVolume && (
                  <span className="text-xs text-gray-400">
                    Sales Volume: <span className="font-medium text-gray-600">{marketRange.salesVolume}</span>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm overflow-hidden">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Low</p>
                  <p className="text-base sm:text-xl font-bold text-green-600 truncate">
                    {formatPrice(marketRange.low)}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm overflow-hidden border-2 border-blue-200">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Median</p>
                  <p className="text-base sm:text-xl font-bold text-blue-600 truncate">
                    {formatPrice(marketRange.median)}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm overflow-hidden">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Average</p>
                  <p className="text-base sm:text-xl font-bold text-indigo-600 truncate">
                    {formatPrice(marketRange.average)}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm overflow-hidden">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">High</p>
                  <p className="text-base sm:text-xl font-bold text-purple-600 truncate">
                    {formatPrice(marketRange.high)}
                  </p>
                </div>
              </div>
              {priceIncrease && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  Grading premium: <span className="text-emerald-600 font-semibold">+{priceIncrease}%</span> from raw to graded
                </p>
              )}
            </div>
          )}

          {/* Grade-Based Price Chart - Shows market prices by grade */}
          {chartData.length >= 2 && (
            <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Price by Grade</h4>
                  <p className="text-xs text-gray-500">
                    Market prices from raw to graded
                  </p>
                </div>
                <button
                  onClick={() => setShowChart(!showChart)}
                  className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                >
                  {showChart ? 'Hide' : 'Show'}
                </button>
              </div>

              {showChart && (
                <div style={{ height: Math.max(180, chartData.length * 40) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb' }}
                        tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#374151' }}
                        tickLine={false}
                        axisLine={false}
                        width={70}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="price"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={28}
                      >
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.grade === 'Raw' ? '#f59e0b' :
                              entry.grade === 'DCM' ? '#8b5cf6' :
                              '#10b981'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Chart Legend */}
              {showChart && (
                <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-amber-500"></div>
                    <span>Raw</span>
                  </div>
                  {dcmGrade && dcmEstimate && (
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-violet-500"></div>
                      <span>Graded: DCM</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-emerald-500"></div>
                    <span>Graded: Mail Away</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grading Company Prices - PSA, BGS, SGC */}
          {(getPsaGradesWithPrices().length > 0 || Object.keys(priceData.prices.bgs).length > 0 || Object.keys(priceData.prices.sgc).length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {/* PSA Prices */}
              {getPsaGradesWithPrices().length > 0 && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <span className="text-xs font-semibold text-gray-700 block mb-2">PSA</span>
                  <div className="space-y-1">
                    {getPsaGradesWithPrices()
                      .sort(([a], [b]) => Number(a) - Number(b)) // Sort ascending
                      .map(([grade, price]) => (
                        <div key={grade} className="flex justify-between text-xs">
                          <span className="text-gray-600">Grade {grade}</span>
                          <span className={`font-semibold ${
                            Number(grade) >= 9 ? 'text-emerald-600' :
                            Number(grade) >= 7 ? 'text-blue-600' :
                            'text-gray-600'
                          }`}>
                            {formatPrice(price)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* BGS Prices */}
              {Object.keys(priceData.prices.bgs).length > 0 && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <span className="text-xs font-semibold text-gray-700 block mb-2">BGS</span>
                  <div className="space-y-1">
                    {Object.entries(priceData.prices.bgs)
                      .filter(([_, price]) => price > 0)
                      .sort(([a], [b]) => Number(a) - Number(b)) // Sort ascending
                      .map(([grade, price]) => (
                        <div key={grade} className="flex justify-between text-xs">
                          <span className="text-gray-600">Grade {grade}</span>
                          <span className={`font-semibold ${
                            Number(grade) >= 9 ? 'text-emerald-600' :
                            Number(grade) >= 7 ? 'text-blue-600' :
                            'text-gray-600'
                          }`}>
                            {formatPrice(price)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* SGC Prices */}
              {Object.keys(priceData.prices.sgc).length > 0 && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <span className="text-xs font-semibold text-gray-700 block mb-2">SGC</span>
                  <div className="space-y-1">
                    {Object.entries(priceData.prices.sgc)
                      .filter(([_, price]) => price > 0)
                      .sort(([a], [b]) => Number(a) - Number(b)) // Sort ascending
                      .map(([grade, price]) => (
                        <div key={grade} className="flex justify-between text-xs">
                          <span className="text-gray-600">Grade {grade}</span>
                          <span className={`font-semibold ${
                            Number(grade) >= 9 ? 'text-emerald-600' :
                            Number(grade) >= 7 ? 'text-blue-600' :
                            'text-gray-600'
                          }`}>
                            {formatPrice(price)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Source Attribution */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Data from SportsCardsPro</span>
              <a
                href={getSportsCardsProUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-800"
              >
                View on SportsCardsPro
              </a>
            </div>

            {/* Match Confidence Definitions Accordion */}
            <details className="mt-3">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 flex items-center gap-1">
                <svg className="w-3 h-3 transition-transform details-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                How match confidence works
              </summary>
              <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-2">
                <p className="font-medium text-gray-700">Match Confidence Levels:</p>
                <ul className="space-y-1.5 ml-1">
                  <li className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">Best Match</span>
                    <span>Card number, parallel type, and serial number all matched</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium whitespace-nowrap">Good Match</span>
                    <span>Card number matched with either parallel or serial number</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium whitespace-nowrap">Partial Match</span>
                    <span>Basic info matched (card number/set) or using similar card pricing</span>
                  </li>
                </ul>
                <p className="text-gray-500 mt-2 pt-2 border-t border-gray-200">
                  Use "Change Parallel" to manually select the exact variant if the auto-match isn't correct.
                </p>
              </div>
            </details>
          </div>
        </>
      )}
    </div>
  );
}
