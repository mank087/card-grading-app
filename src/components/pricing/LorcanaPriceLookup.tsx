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

interface NormalizedLorcanaPrices {
  raw: number | null;
  psa: Record<string, number>;
  bgs: Record<string, number>;
  sgc: Record<string, number>;
  cgc: Record<string, number>;
  estimatedDcm: number | null;
  productId: string;
  productName: string;
  setName: string;
  lastUpdated: string;
  salesVolume: string | null;
  isFallback?: boolean;
  exactMatchName?: string;
}

interface AvailableVariant {
  id: string;
  name: string;
  setName: string;
  hasPrice: boolean;
}

interface LorcanaPricingResult {
  success: boolean;
  data?: {
    prices: NormalizedLorcanaPrices;
    estimatedValue: number | null;
    matchConfidence: 'high' | 'medium' | 'low' | 'none';
    queryUsed: string;
    availableVariants?: AvailableVariant[];
  };
  error?: string;
  cached?: boolean;
  cacheAge?: number;
}

interface LorcanaPriceLookupProps {
  card: {
    id?: string;
    card_name?: string;
    set_name?: string;
    collector_number?: string;
    year?: string;
    is_foil?: boolean;
    rarity_or_variant?: string;
    // Saved manual selection
    dcm_selected_product_id?: string;
    dcm_selected_product_name?: string;
  };
  dcmGrade?: number;
  isOwner?: boolean;
  onPriceLoad?: (data: {
    estimatedValue: number | null;
    matchConfidence: 'high' | 'medium' | 'low' | 'none';
    productName: string | null;
    priceChartingUrl?: string;
  }) => void;
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

export function LorcanaPriceLookup({ card, dcmGrade, isOwner = false, onPriceLoad }: LorcanaPriceLookupProps) {
  const [priceData, setPriceData] = useState<LorcanaPricingResult['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllGrades, setShowAllGrades] = useState(false);
  const [showChart, setShowChart] = useState(true);

  // Variant selection state
  const [availableVariants, setAvailableVariants] = useState<AvailableVariant[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(card.dcm_selected_product_id || null);
  const [isManualSelection, setIsManualSelection] = useState<boolean>(!!card.dcm_selected_product_id);
  const [showVariantSelector, setShowVariantSelector] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);

  // Cache status
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState<number | null>(null);

  // Non-owner notification
  const [showOwnerNote, setShowOwnerNote] = useState(false);

  // Get card name
  const getCardName = () => {
    return card.card_name || '';
  };

  // Detect variant from card fields
  const getVariant = () => {
    if (card.is_foil) return 'Foil';
    if (card.rarity_or_variant) {
      const variantLower = card.rarity_or_variant.toLowerCase();
      if (variantLower.includes('foil')) return 'Foil';
      if (variantLower.includes('enchanted')) return 'Enchanted';
      if (variantLower.includes('promo')) return 'Promo';
      if (variantLower.includes('full art')) return 'Full Art';
      return card.rarity_or_variant;
    }
    return undefined;
  };

  const fetchPrices = async (overrideProductId?: string, forceRefresh: boolean = false) => {
    const cardName = getCardName();
    if (!cardName) {
      return;
    }

    setLoading(true);
    setError(null);
    setIsCached(false);
    setCacheAge(null);

    const productIdToUse = overrideProductId || selectedProductId;

    // If using manual selection, fetch that specific product
    if (productIdToUse) {
      console.log('[LorcanaPriceLookup] === FETCHING MANUAL SELECTION ===');
      console.log('[LorcanaPriceLookup] Product ID:', productIdToUse);
      try {
        const response = await fetch('/api/pricing/lorcana', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedProductId: productIdToUse,
            dcmGrade,
            cardId: card.id,
            forceRefresh,
          }),
        });

        const data: LorcanaPricingResult = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch prices');
        }

        setPriceData(data.data);
        setIsManualSelection(true);
        setIsCached(data.cached || false);
        setCacheAge(data.cacheAge || null);

        if (onPriceLoad && data.data) {
          // Generate PriceCharting URL from the data
          const slugify = (str: string) => str
            .toLowerCase()
            .replace(/[#]/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .trim();
          const setSlug = slugify(data.data.prices?.setName || '');
          const productSlug = slugify(data.data.prices?.productName || '');
          const priceChartingUrl = (setSlug && productSlug)
            ? `https://www.pricecharting.com/game/${setSlug}/${productSlug}`
            : `https://www.pricecharting.com/search-products?q=${encodeURIComponent(data.data.queryUsed || '')}`;

          onPriceLoad({
            estimatedValue: data.data.estimatedValue,
            matchConfidence: data.data.matchConfidence,
            productName: data.data.prices?.productName || null,
            priceChartingUrl,
          });
        }
      } catch (err) {
        console.error('[LorcanaPriceLookup] Error fetching selected product:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch prices');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Auto-search for prices
    const variant = getVariant();

    console.log('[LorcanaPriceLookup] === SEARCH ===');
    console.log('[LorcanaPriceLookup] Card:', cardName);
    console.log('[LorcanaPriceLookup] Set:', card.set_name);
    console.log('[LorcanaPriceLookup] Collector #:', card.collector_number);
    console.log('[LorcanaPriceLookup] Foil:', card.is_foil || false);
    console.log('[LorcanaPriceLookup] Variant:', variant || '(none)');

    try {
      const response = await fetch('/api/pricing/lorcana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardName,
          setName: card.set_name,
          collectorNumber: card.collector_number,
          year: card.year,
          isFoil: card.is_foil,
          variant,
          dcmGrade,
          includeVariants: true,
          cardId: card.id,
          forceRefresh,
        }),
      });

      const data: LorcanaPricingResult = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch prices');
      }

      setPriceData(data.data);
      setIsManualSelection(false);
      setIsCached(data.cached || false);
      setCacheAge(data.cacheAge || null);

      if (onPriceLoad && data.data) {
        // Generate PriceCharting URL from the data
        const slugify = (str: string) => str
          .toLowerCase()
          .replace(/[#]/g, '')
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .trim();
        const setSlug = slugify(data.data.prices?.setName || '');
        const productSlug = slugify(data.data.prices?.productName || '');
        const priceChartingUrl = (setSlug && productSlug)
          ? `https://www.pricecharting.com/game/${setSlug}/${productSlug}`
          : `https://www.pricecharting.com/search-products?q=${encodeURIComponent(data.data.queryUsed || '')}`;

        onPriceLoad({
          estimatedValue: data.data.estimatedValue,
          matchConfidence: data.data.matchConfidence,
          productName: data.data.prices?.productName || null,
          priceChartingUrl,
        });
      }

      if (data.data?.availableVariants) {
        setAvailableVariants(data.data.availableVariants);
      }
    } catch (err) {
      console.error('[LorcanaPriceLookup] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
    } finally {
      setLoading(false);
    }
  };

  // Fetch available variants
  const fetchVariants = async () => {
    if (!getCardName() || availableVariants.length > 0) {
      setShowVariantSelector(true);
      return;
    }

    setLoadingVariants(true);
    try {
      const response = await fetch('/api/pricing/lorcana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardName: getCardName(),
          setName: card.set_name,
          collectorNumber: card.collector_number,
          includeVariants: true,
        }),
      });

      const data: LorcanaPricingResult = await response.json();
      if (data.data?.availableVariants) {
        setAvailableVariants(data.data.availableVariants);
      }
      setShowVariantSelector(true);
    } catch (err) {
      console.error('[LorcanaPriceLookup] Error fetching variants:', err);
    } finally {
      setLoadingVariants(false);
    }
  };

  // Save manual selection
  const saveSelection = async (productId: string, productName: string) => {
    if (!card.id) return;

    const session = getStoredSession();
    if (!session?.access_token) return;

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
    } catch (err) {
      console.error('[LorcanaPriceLookup] Error saving selection:', err);
    } finally {
      setSavingSelection(false);
    }
  };

  // Clear manual selection
  const clearSelection = async () => {
    if (!card.id) {
      setSelectedProductId(null);
      setIsManualSelection(false);
      setShowVariantSelector(false);
      setLoading(true);
      await fetchPrices(undefined, true);
      return;
    }

    const session = getStoredSession();
    if (!session?.access_token) {
      setSelectedProductId(null);
      setIsManualSelection(false);
      setShowVariantSelector(false);
      setLoading(true);
      await fetchPrices(undefined, true);
      return;
    }

    setSavingSelection(true);
    try {
      const response = await fetch(`/api/pricing/dcm-select?cardId=${card.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to clear selection');
      }

      setSelectedProductId(null);
      setIsManualSelection(false);
      setShowVariantSelector(false);
      setLoading(true);
      await fetchPrices(undefined, true);
    } catch (err) {
      console.error('[LorcanaPriceLookup] Error clearing selection:', err);
    } finally {
      setSavingSelection(false);
    }
  };

  // Handle variant selection
  const handleVariantSelect = async (productId: string) => {
    const selected = availableVariants.find(v => v.id === productId);
    if (!selected) return;

    setSelectedProductId(productId);
    setShowVariantSelector(false);
    setLoading(true);

    await fetchPrices(productId);

    if (card.id) {
      await saveSelection(productId, selected.name);
    }
  };

  useEffect(() => {
    if (getCardName()) {
      if (card.dcm_selected_product_id) {
        setSelectedProductId(card.dcm_selected_product_id);
        setIsManualSelection(true);
        fetchPrices(card.dcm_selected_product_id);
      } else {
        fetchPrices();
      }
    }
  }, [card.card_name, card.set_name, card.collector_number, card.is_foil, dcmGrade, card.dcm_selected_product_id]);

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

  // Build chart data
  const getChartData = (dcmEstimateValue?: number | null): ChartDataPoint[] => {
    if (!priceData?.prices) return [];

    const data: ChartDataPoint[] = [];

    if (priceData.prices.raw && priceData.prices.raw > 0) {
      data.push({
        grade: 'Raw',
        gradeNum: 0,
        price: priceData.prices.raw,
        label: 'Raw (Ungraded)',
      });
    }

    if (dcmEstimateValue && dcmEstimateValue > 0 && dcmGrade) {
      data.push({
        grade: 'DCM',
        gradeNum: dcmGrade,
        price: dcmEstimateValue,
        label: `DCM ${Math.round(dcmGrade)}`,
      });
    }

    const grades = ['7', '8', '9', '9.5', '10'];
    for (const grade of grades) {
      const prices: number[] = [];
      if (priceData.prices.psa[grade] && priceData.prices.psa[grade] > 0) prices.push(priceData.prices.psa[grade]);
      if (priceData.prices.bgs[grade] && priceData.prices.bgs[grade] > 0) prices.push(priceData.prices.bgs[grade]);
      if (priceData.prices.sgc[grade] && priceData.prices.sgc[grade] > 0) prices.push(priceData.prices.sgc[grade]);
      if (priceData.prices.cgc?.[grade] && priceData.prices.cgc[grade] > 0) prices.push(priceData.prices.cgc[grade]);

      if (prices.length > 0) {
        data.push({
          grade: grade,
          gradeNum: parseFloat(grade),
          price: Math.max(...prices),
          label: `Grade ${grade}`,
        });
      }
    }

    data.sort((a, b) => a.price - b.price);
    return data;
  };

  // Get PSA grades with prices
  const getPsaGradesWithPrices = () => {
    if (!priceData?.prices.psa) return [];
    return Object.entries(priceData.prices.psa)
      .filter(([_, price]) => price > 0)
      .sort(([a], [b]) => Number(b) - Number(a));
  };

  // Generate PriceCharting URL
  const getPriceChartingUrl = () => {
    if (!priceData) return 'https://www.pricecharting.com/category/lorcana-cards';

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
      return `https://www.pricecharting.com/game/${setSlug}/${productSlug}`;
    }

    return `https://www.pricecharting.com/search-products?q=${encodeURIComponent(priceData.queryUsed || getCardName())}`;
  };

  // Get market range
  const getMarketRange = () => {
    if (!priceData?.prices) return null;
    const raw = priceData.prices.raw;

    const allPrices: number[] = [];
    if (raw && raw > 0) allPrices.push(raw);
    Object.values(priceData.prices.psa).forEach(price => { if (price && price > 0) allPrices.push(price); });
    Object.values(priceData.prices.bgs).forEach(price => { if (price && price > 0) allPrices.push(price); });
    Object.values(priceData.prices.sgc).forEach(price => { if (price && price > 0) allPrices.push(price); });
    if (priceData.prices.cgc) {
      Object.values(priceData.prices.cgc).forEach(price => { if (price && price > 0) allPrices.push(price); });
    }

    if (allPrices.length === 0) return null;

    const sortedPrices = [...allPrices].sort((a, b) => a - b);
    const low = sortedPrices[0];
    const high = sortedPrices[sortedPrices.length - 1];
    const mid = Math.floor(sortedPrices.length / 2);
    const median = sortedPrices.length % 2 !== 0
      ? sortedPrices[mid]
      : (sortedPrices[mid - 1] + sortedPrices[mid]) / 2;
    const average = allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length;

    return {
      low: Math.round(low * 100) / 100,
      high: Math.round(high * 100) / 100,
      median: Math.round(median * 100) / 100,
      average: Math.round(average * 100) / 100,
      salesVolume: priceData.prices.salesVolume,
    };
  };

  // Get DCM estimated value
  const getDcmEstimatedValue = () => {
    if (!priceData?.prices || !dcmGrade) return null;

    const raw = priceData.prices.raw;
    const psaGrades = priceData.prices.psa;

    const roundedGrade = Math.round(dcmGrade).toString();
    const halfGrade = dcmGrade >= 9 ? '9.5' : null;
    const psaEquivalentPrice = psaGrades[roundedGrade] || (halfGrade && psaGrades[halfGrade]) || null;

    if (!psaEquivalentPrice && raw) {
      return {
        value: Math.round(raw * 3 * 100) / 100,
        multiplier: null,
        rawPrice: raw,
        psaPrice: null,
      };
    }

    if (!raw || !psaEquivalentPrice) return null;

    let dcmMultiplier: number;
    if (dcmGrade >= 9.5) {
      dcmMultiplier = 0.70;
    } else if (dcmGrade >= 9) {
      dcmMultiplier = 0.65;
    } else if (dcmGrade >= 8) {
      dcmMultiplier = 0.55;
    } else if (dcmGrade >= 7) {
      dcmMultiplier = 0.45;
    } else {
      dcmMultiplier = 0.35;
    }

    const psaPremium = psaEquivalentPrice - raw;
    const dcmValue = raw + (psaPremium * dcmMultiplier);

    return {
      value: Math.round(dcmValue * 100) / 100,
      multiplier: dcmMultiplier,
      rawPrice: raw,
      psaPrice: psaEquivalentPrice,
    };
  };

  // Get price increase percentage
  const getPriceIncrease = () => {
    if (!priceData?.prices) return null;
    const raw = priceData.prices.raw;
    const psa10 = priceData.prices.psa['10'];
    if (!raw || !psa10 || raw === 0) return null;
    return ((psa10 - raw) / raw * 100).toFixed(0);
  };

  if (!getCardName()) {
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
          title={isCached ? 'Click to fetch fresh prices from PriceCharting' : 'Refresh prices'}
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
                 priceData.matchConfidence === 'medium' ? 'Good Match' : 'Partial Match'}
              </span>
            </div>

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

            {/* Expandable section for other variants */}
            <details className="mt-4 border-t border-gray-100 pt-3 group">
              <summary className="text-xs text-emerald-600 cursor-pointer hover:text-emerald-800 font-medium flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden">
                <svg className="w-3 h-3 transition-transform duration-200 group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                See other card variants (Foil, Enchanted, etc.)
              </summary>

              <div className="mt-3">
                {isManualSelection && (
                  <button
                    onClick={clearSelection}
                    disabled={savingSelection}
                    className="w-full text-left px-3 py-2 mb-2 rounded text-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Reset to auto-match</span>
                      {savingSelection && <span className="text-xs">Resetting...</span>}
                    </div>
                    <p className="text-xs text-emerald-600 mt-0.5">Let the system find the best matching card</p>
                  </button>
                )}

                {availableVariants.length === 0 ? (
                  <button
                    onClick={fetchVariants}
                    disabled={loadingVariants}
                    className="w-full text-center px-3 py-2 rounded text-sm bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors"
                  >
                    {loadingVariants ? 'Loading variants...' : 'Load available variants'}
                  </button>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-2">
                      {isOwner ? 'Select a different variant to update pricing:' : 'Available variants for this card:'}
                    </p>

                    {showOwnerNote && (
                      <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                        <svg className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-xs text-yellow-800 font-medium">Only the card owner can update pricing</p>
                          <p className="text-xs text-yellow-600 mt-0.5">Sign in as the owner to select a different variant.</p>
                        </div>
                        <button onClick={() => setShowOwnerNote(false)} className="text-yellow-400 hover:text-yellow-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}

                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {availableVariants.map((variant) => (
                        <button
                          key={variant.id}
                          onClick={() => {
                            if (!isOwner) {
                              setShowOwnerNote(true);
                              return;
                            }
                            handleVariantSelect(variant.id);
                          }}
                          disabled={savingSelection}
                          className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                            variant.id === priceData.prices.productId
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : variant.hasPrice
                              ? 'bg-gray-50 hover:bg-emerald-50 text-gray-700 border border-transparent'
                              : 'bg-gray-50 text-gray-400 border border-transparent'
                          } ${!isOwner && variant.id !== priceData.prices.productId ? 'cursor-not-allowed opacity-75' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate font-medium">{variant.name}</span>
                            <span className={`text-xs flex-shrink-0 ml-2 ${variant.hasPrice ? 'text-green-600' : 'text-gray-400'}`}>
                              {variant.id === priceData.prices.productId ? 'Current' : variant.hasPrice ? 'Has prices' : 'No prices'}
                            </span>
                          </div>
                          {variant.setName && (
                            <span className="text-xs text-gray-500 truncate block mt-0.5">{variant.setName}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </details>
          </div>

          {/* Fallback pricing notice */}
          {priceData.prices.isFallback && priceData.prices.exactMatchName && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-indigo-800">Using Similar Card Pricing</p>
                  <p className="text-xs text-indigo-700 mt-1">
                    Your exact card (<span className="font-medium">{priceData.prices.exactMatchName}</span>) doesn't have enough sales data yet.
                    Showing pricing from a similar variant as a reference.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* DCM Estimated Value */}
          {dcmEstimate && dcmGrade && (
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 mb-4 shadow-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
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

          {/* Limited pricing data notice */}
          {priceData.matchConfidence === 'low' && !marketRange && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-800 mb-1">Limited Pricing Data Available</p>
                  <p className="text-xs text-blue-700">
                    We found this card in our database, but there isn't enough sales history yet to provide accurate market pricing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Market Price Range */}
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
                  <p className="text-base sm:text-xl font-bold text-green-600 truncate">{formatPrice(marketRange.low)}</p>
                </div>
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm overflow-hidden border-2 border-blue-200">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Median</p>
                  <p className="text-base sm:text-xl font-bold text-blue-600 truncate">{formatPrice(marketRange.median)}</p>
                </div>
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm overflow-hidden">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Average</p>
                  <p className="text-base sm:text-xl font-bold text-indigo-600 truncate">{formatPrice(marketRange.average)}</p>
                </div>
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm overflow-hidden">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">High</p>
                  <p className="text-base sm:text-xl font-bold text-purple-600 truncate">{formatPrice(marketRange.high)}</p>
                </div>
              </div>
              {priceIncrease && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  Grading premium: <span className="text-emerald-600 font-semibold">+{priceIncrease}%</span> from raw to graded
                </p>
              )}
            </div>
          )}

          {/* Price by Grade Chart */}
          {chartData.length >= 2 && (
            <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Price by Grade</h4>
                  <p className="text-xs text-gray-500">Market prices from raw to graded</p>
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
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
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
                      <Bar dataKey="price" radius={[0, 4, 4, 0]} maxBarSize={28}>
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
                    <span>Graded: PSA/BGS/CGC</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grading Company Prices */}
          {(getPsaGradesWithPrices().length > 0 || Object.keys(priceData.prices.bgs).length > 0 || Object.keys(priceData.prices.cgc || {}).length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {/* PSA Prices */}
              {getPsaGradesWithPrices().length > 0 && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <span className="text-xs font-semibold text-gray-700 block mb-2">PSA</span>
                  <div className="space-y-1">
                    {getPsaGradesWithPrices()
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([grade, price]) => (
                        <div key={grade} className="flex justify-between text-xs">
                          <span className="text-gray-600">Grade {grade}</span>
                          <span className={`font-semibold ${Number(grade) >= 9 ? 'text-emerald-600' : Number(grade) >= 7 ? 'text-blue-600' : 'text-gray-600'}`}>
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
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([grade, price]) => (
                        <div key={grade} className="flex justify-between text-xs">
                          <span className="text-gray-600">Grade {grade}</span>
                          <span className={`font-semibold ${Number(grade) >= 9 ? 'text-emerald-600' : Number(grade) >= 7 ? 'text-blue-600' : 'text-gray-600'}`}>
                            {formatPrice(price)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* CGC Prices */}
              {priceData.prices.cgc && Object.keys(priceData.prices.cgc).length > 0 && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <span className="text-xs font-semibold text-gray-700 block mb-2">CGC</span>
                  <div className="space-y-1">
                    {Object.entries(priceData.prices.cgc)
                      .filter(([_, price]) => price > 0)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([grade, price]) => (
                        <div key={grade} className="flex justify-between text-xs">
                          <span className="text-gray-600">Grade {grade}</span>
                          <span className={`font-semibold ${Number(grade) >= 9 ? 'text-emerald-600' : Number(grade) >= 7 ? 'text-blue-600' : 'text-gray-600'}`}>
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
              <span>Data from PriceCharting</span>
              <a
                href={getPriceChartingUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-800"
              >
                View on PriceCharting
              </a>
            </div>

            {/* Match Confidence Explanation */}
            <details className="mt-3 group">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 flex items-center gap-1">
                <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                How match confidence works
              </summary>
              <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-2">
                <p className="font-medium text-gray-700">Match Confidence Levels:</p>
                <ul className="space-y-1.5 ml-1">
                  <li className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">Best Match</span>
                    <span>Card name, collector number, and set all matched</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium whitespace-nowrap">Good Match</span>
                    <span>Card name matched with collector number or set</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium whitespace-nowrap">Partial Match</span>
                    <span>Basic info matched or using similar card pricing</span>
                  </li>
                </ul>
                <p className="text-gray-500 mt-2 pt-2 border-t border-gray-200">
                  Use "See other card variants" to manually select the exact variant if the auto-match isn't correct.
                </p>
              </div>
            </details>
          </div>
        </>
      )}
    </div>
  );
}
