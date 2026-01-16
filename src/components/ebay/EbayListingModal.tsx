'use client';

import React, { useState, useEffect } from 'react';
import { generateCardImages, CardImageData } from '@/lib/cardImageGenerator';
import { generateMiniReportJpg } from '@/lib/miniReportJpgGenerator';
import { FoldableLabelData, generateQRCodeWithLogo, loadLogoAsBase64 } from '@/lib/foldableLabelGenerator';
import { getCardLabelData } from '@/lib/useLabelData';
import { getStoredSession } from '@/lib/directAuth';
import { getAuthenticatedClient } from '@/lib/directAuth';
import { LISTING_FORMATS, LISTING_DURATIONS, LISTING_DURATION_LABELS, DCM_TO_EBAY_CATEGORY, EBAY_CATEGORIES } from '@/lib/ebay/constants';
import { mapCardToItemSpecifics, getCategoryForCardType, getSerialNumbering, getSerialDenominator, type ItemSpecific } from '@/lib/ebay/itemSpecifics';

// Helper: Get condition label from grade
function getConditionLabel(grade: number): string {
  if (grade >= 10) return 'Pristine';
  if (grade >= 9) return 'Gem Mint';
  if (grade >= 8) return 'Near Mint-Mint';
  if (grade >= 7) return 'Near Mint';
  if (grade >= 6) return 'Excellent-Mint';
  if (grade >= 5) return 'Excellent';
  if (grade >= 4) return 'Very Good-Excellent';
  if (grade >= 3) return 'Very Good';
  if (grade >= 2) return 'Good';
  if (grade >= 1) return 'Fair';
  return 'Poor';
}

// Helper: Get grade color for HTML styling
function getGradeColor(grade: number): string {
  if (grade >= 9) return '#10B981'; // Green
  if (grade >= 7) return '#3B82F6'; // Blue
  if (grade >= 5) return '#F59E0B'; // Amber
  return '#EF4444'; // Red
}

// Generate rich HTML description for eBay listing
function generateHtmlDescription(data: {
  primaryName: string;
  setName: string;
  cardNumber: string;
  grade: number;
  conditionLabel: string;
  overview: string;
  subgrades: { centering: number; corners: number; edges: number; surface: number };
  serial: string;
}): string {
  const { primaryName, setName, cardNumber, grade, conditionLabel, overview, subgrades, serial } = data;
  const gradeColor = getGradeColor(grade);

  // DCM brand colors
  const dcmPurple = '#7C3AED';
  const dcmPurpleLight = '#A78BFA';
  const dcmGray = '#4B5563';

  return `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
  <!-- Header Banner -->
  <div style="background: linear-gradient(135deg, ${dcmPurple} 0%, #5B21B6 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
    <h2 style="margin: 0 0 8px 0; font-size: 24px;">DCM Graded Card</h2>
    <p style="margin: 0; opacity: 0.9; font-size: 14px;">Professional AI-Powered Card Grading</p>
  </div>

  <!-- Grade Display -->
  <div style="background: #F9FAFB; border: 2px solid ${gradeColor}; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center;">
    <div style="font-size: 48px; font-weight: bold; color: ${gradeColor};">${grade}</div>
    <div style="font-size: 18px; color: ${dcmGray}; font-weight: 600;">${conditionLabel}</div>
    <div style="font-size: 12px; color: #9CA3AF; margin-top: 8px;">DCM Serial: <strong>${serial}</strong></div>
  </div>

  <!-- Card Details -->
  <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="color: ${dcmPurple}; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid ${dcmPurpleLight}; padding-bottom: 8px;">Card Details</h3>
    <table style="width: 100%; border-collapse: collapse;">
      ${primaryName ? `<tr><td style="padding: 8px 0; color: ${dcmGray}; font-weight: 600;">Character/Player:</td><td style="padding: 8px 0; text-align: right;">${primaryName}</td></tr>` : ''}
      ${setName ? `<tr><td style="padding: 8px 0; color: ${dcmGray}; font-weight: 600;">Set:</td><td style="padding: 8px 0; text-align: right;">${setName}</td></tr>` : ''}
      ${cardNumber ? `<tr><td style="padding: 8px 0; color: ${dcmGray}; font-weight: 600;">Card Number:</td><td style="padding: 8px 0; text-align: right;">#${cardNumber}</td></tr>` : ''}
    </table>
  </div>

  <!-- Card Overview -->
  ${overview ? `
  <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="color: ${dcmPurple}; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid ${dcmPurpleLight}; padding-bottom: 8px;">Condition Overview</h3>
    <p style="color: ${dcmGray}; line-height: 1.6; margin: 0;">${overview}</p>
  </div>
  ` : ''}

  <!-- Sub-Grades -->
  <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="color: ${dcmPurple}; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid ${dcmPurpleLight}; padding-bottom: 8px;">DCM Sub-Grades</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 12px 8px; text-align: center; background: #F9FAFB; border-radius: 8px 0 0 8px;">
          <div style="font-size: 24px; font-weight: bold; color: ${getGradeColor(subgrades.centering)};">${subgrades.centering}</div>
          <div style="font-size: 12px; color: ${dcmGray};">Centering</div>
        </td>
        <td style="padding: 12px 8px; text-align: center; background: #F9FAFB;">
          <div style="font-size: 24px; font-weight: bold; color: ${getGradeColor(subgrades.corners)};">${subgrades.corners}</div>
          <div style="font-size: 12px; color: ${dcmGray};">Corners</div>
        </td>
        <td style="padding: 12px 8px; text-align: center; background: #F9FAFB;">
          <div style="font-size: 24px; font-weight: bold; color: ${getGradeColor(subgrades.edges)};">${subgrades.edges}</div>
          <div style="font-size: 12px; color: ${dcmGray};">Edges</div>
        </td>
        <td style="padding: 12px 8px; text-align: center; background: #F9FAFB; border-radius: 0 8px 8px 0;">
          <div style="font-size: 24px; font-weight: bold; color: ${getGradeColor(subgrades.surface)};">${subgrades.surface}</div>
          <div style="font-size: 12px; color: ${dcmGray};">Surface</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- DCM Footer -->
  <div style="background: linear-gradient(135deg, ${dcmPurple} 0%, #5B21B6 100%); color: white; padding: 16px 20px; border-radius: 8px; text-align: center;">
    <div style="font-size: 18px; font-weight: bold;">Graded by DCM</div>
    <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.9;">Professional AI-Powered Card Authentication & Grading</p>
    <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.7;">Verify this card at dcmgrading.com</p>
  </div>
</div>
`.trim();
}

interface EbayListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: any;
  cardType?: 'pokemon' | 'sports' | 'mtg' | 'lorcana' | 'other';
  showFounderEmblem?: boolean;
  labelStyle?: 'modern' | 'traditional';
}

type ListingStep = 'images' | 'details' | 'specifics' | 'shipping' | 'review' | 'publishing' | 'success' | 'error';

export const EbayListingModal: React.FC<EbayListingModalProps> = ({
  isOpen,
  onClose,
  card,
  cardType = 'sports',
  showFounderEmblem = false,
  labelStyle = 'modern',
}) => {
  const [step, setStep] = useState<ListingStep>('images');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image state
  const [imageUrls, setImageUrls] = useState<{
    front?: string;
    back?: string;
    miniReport?: string;
  }>({});
  const [imageBlobs, setImageBlobs] = useState<{
    front?: Blob;
    back?: Blob;
    miniReport?: Blob;
  }>({});
  const [selectedImages, setSelectedImages] = useState<{
    front: boolean;
    back: boolean;
    miniReport: boolean;
  }>({ front: true, back: true, miniReport: true });

  // Listing details state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showDescriptionCode, setShowDescriptionCode] = useState(false);
  const [price, setPrice] = useState('');
  const [listingFormat, setListingFormat] = useState<'FIXED_PRICE' | 'AUCTION'>('FIXED_PRICE');
  const [bestOfferEnabled, setBestOfferEnabled] = useState(true); // Accept Offers enabled by default
  const [duration, setDuration] = useState('GTC');

  // Item specifics state
  const [itemSpecifics, setItemSpecifics] = useState<ItemSpecific[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [aspectsLoaded, setAspectsLoaded] = useState(false);

  // Shipping & Returns form state (inline, not policy-based)
  const [shippingForm, setShippingForm] = useState({
    shippingType: 'CALCULATED' as 'FREE' | 'FLAT_RATE' | 'CALCULATED',
    flatRateAmount: 5.00,
    handlingDays: 1,
    returnsAccepted: false,
    returnPeriodDays: 30,
    returnShippingPaidBy: 'BUYER' as 'BUYER' | 'SELLER',
  });

  // Result state
  const [listingResult, setListingResult] = useState<{
    listingId?: string;
    listingUrl?: string;
    sku: string;
  } | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('images');
      setError(null);
      setImageUrls({});
      setImageBlobs({});
      setSelectedImages({ front: true, back: true, miniReport: true });
      setListingResult(null);
      setListingFormat('FIXED_PRICE');
      setBestOfferEnabled(true);
      setDuration('GTC');
      setShowDescriptionCode(false);
      setAspectsLoaded(false);

      // Generate default title: character - subset - card number - DCM Grade X - Condition Label
      const labelData = getCardLabelData(card);
      const grade = labelData.grade ?? 0;
      const cardInfo = card.conversational_card_info || {};

      // Get condition label
      const conditionLabel = labelData.condition || getConditionLabel(grade);

      // Build title parts with dash separator
      const titleParts: string[] = [];

      // Primary subject (player/character/featured)
      const primaryName = labelData.primaryName || card.featured || card.pokemon_featured || card.card_name || '';
      if (primaryName) titleParts.push(primaryName);

      // Set/Subset name
      const setName = labelData.setName || cardInfo.set_name || card.card_set;
      if (setName) titleParts.push(setName);

      // Card number if available
      const cardNumber = labelData.cardNumber || cardInfo.card_number || card.card_number;
      if (cardNumber) titleParts.push(`#${cardNumber}`);

      // Serial numbering (e.g., "/99", "/25") - just the denominator
      const serialNum = getSerialNumbering(card);
      const serialDenom = getSerialDenominator(serialNum);
      if (serialDenom) titleParts.push(serialDenom);

      // Grade info
      titleParts.push(`DCM Grade ${Math.round(grade)}`);

      // Condition label
      if (conditionLabel) titleParts.push(conditionLabel);

      const defaultTitle = titleParts.join(' - ').substring(0, 80);
      setTitle(defaultTitle);

      // Generate HTML description with DCM branding
      const weightedScores = card.conversational_weighted_sub_scores || {};
      const subScores = card.conversational_sub_scores || {};
      const overview = card.conversational_final_grade_summary || card.conversational_summary || '';

      const centering = Math.round(weightedScores.centering ?? subScores.centering?.weighted ?? 0);
      const corners = Math.round(weightedScores.corners ?? subScores.corners?.weighted ?? 0);
      const edges = Math.round(weightedScores.edges ?? subScores.edges?.weighted ?? 0);
      const surface = Math.round(weightedScores.surface ?? subScores.surface?.weighted ?? 0);

      // Build rich HTML description
      const htmlDescription = generateHtmlDescription({
        primaryName,
        setName,
        cardNumber,
        grade: Math.round(grade),
        conditionLabel,
        overview,
        subgrades: { centering, corners, edges, surface },
        serial: card.serial || 'N/A',
      });

      setDescription(htmlDescription);

      // Initialize item specifics based on card type
      const ebayCategory = getCategoryForCardType(cardType);
      setCategoryId(ebayCategory);

      // Pre-fill item specifics from card data
      const defaultSpecifics = mapCardToItemSpecifics(card, cardType);
      setItemSpecifics(defaultSpecifics);
    }
  }, [isOpen, card, cardType]);

  // Generate images when modal opens
  useEffect(() => {
    if (isOpen && step === 'images' && !imageBlobs.front) {
      generateImages();
    }
  }, [isOpen, step]);

  // Fetch available aspects when we reach the specifics step
  useEffect(() => {
    if (step === 'specifics' && !aspectsLoaded && categoryId) {
      fetchAndMergeAspects();
    }
  }, [step, aspectsLoaded, categoryId]);

  const fetchAndMergeAspects = async () => {
    try {
      const session = getStoredSession();
      if (!session?.access_token) return;

      const response = await fetch(`/api/ebay/aspects?category_id=${categoryId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const fetchedAspects = data.aspects || [];

        // Get existing pre-filled specifics names (lowercase for comparison)
        const existingNames = new Set(
          itemSpecifics.map(s => s.name.toLowerCase())
        );

        // Add aspects that aren't already in our pre-filled list
        const additionalSpecifics: ItemSpecific[] = [];
        for (const aspect of fetchedAspects) {
          const aspectName = aspect.localizedAspectName;
          if (!existingNames.has(aspectName.toLowerCase())) {
            additionalSpecifics.push({
              name: aspectName,
              value: '',
              required: aspect.aspectConstraint?.aspectRequired || false,
              editable: true,
            });
          }
        }

        // Merge: pre-filled first, then additional empty fields
        if (additionalSpecifics.length > 0) {
          setItemSpecifics(prev => [...prev, ...additionalSpecifics]);
        }
      }
    } catch (err) {
      console.error('[eBay Listing] Failed to fetch aspects:', err);
    } finally {
      setAspectsLoaded(true);
    }
  };

  const generateImages = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const labelData = getCardLabelData(card);

      // Get image URLs
      let frontImageUrl = card.front_url;
      let backImageUrl = card.back_url;

      if (!frontImageUrl || !backImageUrl) {
        if (!card.front_path || !card.back_path) {
          throw new Error('Card images not found');
        }

        const authClient = getAuthenticatedClient();
        const [frontUrl, backUrl] = await Promise.all([
          authClient.storage.from('cards').createSignedUrl(card.front_path, 3600),
          authClient.storage.from('cards').createSignedUrl(card.back_path, 3600),
        ]);

        if (!frontUrl.data?.signedUrl || !backUrl.data?.signedUrl) {
          throw new Error('Failed to get card image URLs');
        }

        frontImageUrl = frontUrl.data.signedUrl;
        backImageUrl = backUrl.data.signedUrl;
      }

      // Get subgrades
      const weightedScores = card.conversational_weighted_sub_scores || {};
      const subScoresData = card.conversational_sub_scores || {};
      const englishName = card.featured || card.pokemon_featured || card.card_name || undefined;

      // Generate card images (front & back with labels)
      const cardImageData: CardImageData = {
        cardName: labelData.primaryName,
        contextLine: labelData.contextLine,
        specialFeatures: labelData.featuresLine || undefined,
        serial: labelData.serial,
        englishName,
        grade: labelData.grade ?? 0,
        conditionLabel: labelData.condition,
        cardUrl: `${window.location.origin}/${cardType}/${card.id}`,
        frontImageUrl,
        backImageUrl,
        showFounderEmblem,
        labelStyle,
        subScores: {
          centering: weightedScores.centering ?? subScoresData.centering?.weighted ?? 0,
          corners: weightedScores.corners ?? subScoresData.corners?.weighted ?? 0,
          edges: weightedScores.edges ?? subScoresData.edges?.weighted ?? 0,
          surface: weightedScores.surface ?? subScoresData.surface?.weighted ?? 0,
        },
      };

      const { front, back } = await generateCardImages(cardImageData);

      // Generate mini-report
      const cardUrl = `${window.location.origin}/${cardType}/${card.id}`;
      const [qrCodeDataUrl, logoDataUrl] = await Promise.all([
        generateQRCodeWithLogo(cardUrl),
        loadLogoAsBase64().catch(() => undefined),
      ]);

      const miniReportData: FoldableLabelData = {
        cardName: labelData.primaryName,
        setName: labelData.setName || '',
        cardNumber: labelData.cardNumber || undefined,
        year: labelData.year || undefined,
        specialFeatures: labelData.featuresLine || undefined,
        serial: labelData.serial,
        englishName,
        grade: labelData.grade ?? 0,
        conditionLabel: labelData.condition,
        subgrades: {
          centering: weightedScores.centering ?? subScoresData.centering?.weighted ?? 0,
          corners: weightedScores.corners ?? subScoresData.corners?.weighted ?? 0,
          edges: weightedScores.edges ?? subScoresData.edges?.weighted ?? 0,
          surface: weightedScores.surface ?? subScoresData.surface?.weighted ?? 0,
        },
        overallSummary: card.conversational_final_grade_summary || 'Card condition analysis not available.',
        qrCodeDataUrl,
        cardUrl,
        logoDataUrl,
      };

      const miniReport = await generateMiniReportJpg(miniReportData);

      // Create preview URLs
      setImageBlobs({ front, back, miniReport });
      setImageUrls({
        front: URL.createObjectURL(front),
        back: URL.createObjectURL(back),
        miniReport: URL.createObjectURL(miniReport),
      });
    } catch (err) {
      console.error('[eBay Listing] Failed to generate images:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate images');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadImages = async (): Promise<string[]> => {
    const session = getStoredSession();
    if (!session?.access_token) {
      throw new Error('Not logged in');
    }

    // Convert blobs to base64
    const toBase64 = (blob: Blob): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    const images: { front?: string; back?: string; miniReport?: string } = {};

    if (selectedImages.front && imageBlobs.front) {
      images.front = await toBase64(imageBlobs.front);
    }
    if (selectedImages.back && imageBlobs.back) {
      images.back = await toBase64(imageBlobs.back);
    }
    if (selectedImages.miniReport && imageBlobs.miniReport) {
      images.miniReport = await toBase64(imageBlobs.miniReport);
    }

    const response = await fetch('/api/ebay/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        cardId: card.id,
        images,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to upload images');
    }

    const data = await response.json();
    const urls: string[] = [];
    if (data.urls.front) urls.push(data.urls.front);
    if (data.urls.back) urls.push(data.urls.back);
    if (data.urls.miniReport) urls.push(data.urls.miniReport);

    return urls;
  };

  const createListing = async () => {
    setStep('publishing');
    setIsLoading(true);
    setError(null);

    try {
      const session = getStoredSession();
      if (!session?.access_token) {
        throw new Error('Not logged in');
      }

      // Upload images first
      const uploadedUrls = await uploadImages();

      if (uploadedUrls.length === 0) {
        throw new Error('No images selected for listing');
      }

      // Create listing via Trading API with inline shipping/returns
      const response = await fetch('/api/ebay/listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          cardId: card.id,
          title,
          description,
          price: parseFloat(price),
          bestOfferEnabled: listingFormat === 'FIXED_PRICE' ? bestOfferEnabled : false,
          duration,
          imageUrls: uploadedUrls,
          itemSpecifics: itemSpecifics
            .filter(spec => spec.name && spec.value && (Array.isArray(spec.value) ? spec.value.length > 0 : spec.value.trim()))
            .map(spec => ({ name: spec.name, value: spec.value })),
          // Inline shipping options (not policy-based)
          shippingType: shippingForm.shippingType,
          flatRateAmount: shippingForm.flatRateAmount,
          handlingDays: shippingForm.handlingDays,
          // Inline return options (not policy-based)
          returnsAccepted: shippingForm.returnsAccepted,
          returnPeriodDays: shippingForm.returnPeriodDays,
          returnShippingPaidBy: shippingForm.returnShippingPaidBy,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.details || 'Failed to create listing');
      }

      const data = await response.json();
      setListingResult({
        listingId: data.listingId,
        listingUrl: data.listingUrl,
        sku: data.sku,
      });
      setStep('success');
    } catch (err) {
      console.error('[eBay Listing] Failed to create listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to create listing');
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    switch (step) {
      case 'images':
        setStep('details');
        break;
      case 'details':
        if (!title.trim()) {
          setError('Title is required');
          return;
        }
        if (!price || parseFloat(price) <= 0) {
          setError('Valid price is required');
          return;
        }
        setError(null);
        setStep('specifics');
        break;
      case 'specifics':
        // Don't validate required fields here - let eBay validate on publish
        // This way users aren't blocked by fields that may not actually be required
        setError(null);
        setStep('shipping');
        break;
      case 'shipping':
        setError(null);
        setStep('review');
        break;
      case 'review':
        createListing();
        break;
    }
  };

  const handleBack = () => {
    setError(null);
    switch (step) {
      case 'details':
        setStep('images');
        break;
      case 'specifics':
        setStep('details');
        break;
      case 'shipping':
        setStep('specifics');
        break;
      case 'review':
        setStep('shipping');
        break;
      case 'error':
        setStep('review');
        break;
    }
  };

  if (!isOpen) return null;

  const labelData = getCardLabelData(card);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">List on eBay</h2>
            <p className="text-sm text-gray-500">{labelData.primaryName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {['images', 'details', 'specifics', 'shipping', 'review'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === s
                      ? 'bg-purple-600 text-white'
                      : ['images', 'details', 'specifics', 'shipping', 'review'].indexOf(step) > i
                      ? 'bg-purple-200 text-purple-700'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i + 1}
                </div>
                {i < 4 && (
                  <div
                    className={`w-10 h-0.5 mx-1 ${
                      ['images', 'details', 'specifics', 'shipping', 'review'].indexOf(step) > i
                        ? 'bg-purple-200'
                        : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>Images</span>
            <span>Details</span>
            <span>Specifics</span>
            <span>Shipping</span>
            <span>Review</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Images */}
          {step === 'images' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Images for Listing</h3>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                  <span className="ml-3 text-gray-600">Generating images...</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {/* Front Image */}
                  <div
                    className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                      selectedImages.front ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedImages(s => ({ ...s, front: !s.front }))}
                  >
                    {imageUrls.front && (
                      <img src={imageUrls.front} alt="Front" className="w-full aspect-[3/4] object-cover" />
                    )}
                    <div className="absolute top-2 right-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        selectedImages.front ? 'bg-purple-500 text-white' : 'bg-white border border-gray-300'
                      }`}>
                        {selectedImages.front && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1 text-center">
                      Front
                    </div>
                  </div>

                  {/* Back Image */}
                  <div
                    className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                      selectedImages.back ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedImages(s => ({ ...s, back: !s.back }))}
                  >
                    {imageUrls.back && (
                      <img src={imageUrls.back} alt="Back" className="w-full aspect-[3/4] object-cover" />
                    )}
                    <div className="absolute top-2 right-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        selectedImages.back ? 'bg-purple-500 text-white' : 'bg-white border border-gray-300'
                      }`}>
                        {selectedImages.back && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1 text-center">
                      Back
                    </div>
                  </div>

                  {/* Mini Report */}
                  <div
                    className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                      selectedImages.miniReport ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedImages(s => ({ ...s, miniReport: !s.miniReport }))}
                  >
                    {imageUrls.miniReport && (
                      <img src={imageUrls.miniReport} alt="Mini Report" className="w-full aspect-[3/4] object-cover" />
                    )}
                    <div className="absolute top-2 right-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        selectedImages.miniReport ? 'bg-purple-500 text-white' : 'bg-white border border-gray-300'
                      }`}>
                        {selectedImages.miniReport && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1 text-center">
                      Report
                    </div>
                  </div>
                </div>
              )}
              <p className="mt-4 text-sm text-gray-500">
                Click images to select/deselect. At least one image is required.
              </p>
            </div>
          )}

          {/* Step 2: Details */}
          {step === 'details' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Listing Details</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.substring(0, 80))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  maxLength={80}
                />
                <p className="mt-1 text-xs text-gray-500">{title.length}/80 characters</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDescriptionCode(!showDescriptionCode)}
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                  >
                    {showDescriptionCode ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Show Preview
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        Edit HTML Code
                      </>
                    )}
                  </button>
                </div>

                {showDescriptionCode ? (
                  <>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-xs"
                      rows={10}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Edit the HTML code directly. Click "Show Preview" to see how it looks.
                    </p>
                  </>
                ) : (
                  <>
                    <div
                      className="w-full border border-gray-300 rounded-lg bg-gray-50 overflow-hidden"
                      style={{ maxHeight: '280px', overflowY: 'auto' }}
                    >
                      <div
                        className="p-3 text-sm"
                        dangerouslySetInnerHTML={{ __html: description }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      This is how your description will appear on eBay. Click "Edit HTML Code" to customize.
                    </p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {listingFormat === 'AUCTION' ? 'Starting Price (USD)' : 'Price (USD)'} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      min="0.01"
                      step="0.01"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Listing Format</label>
                  <select
                    value={listingFormat}
                    onChange={(e) => {
                      const newFormat = e.target.value as 'FIXED_PRICE' | 'AUCTION';
                      setListingFormat(newFormat);
                      // Auto-set recommended duration: 7 days for Auction, GTC for Buy It Now
                      if (newFormat === 'AUCTION') {
                        setDuration('DAYS_7');
                        setBestOfferEnabled(false);
                      } else {
                        setDuration('GTC');
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="FIXED_PRICE">Buy It Now</option>
                    <option value="AUCTION">Auction</option>
                  </select>
                </div>
              </div>

              {/* Accept Offers checkbox - only for Buy It Now */}
              {listingFormat === 'FIXED_PRICE' && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <input
                    type="checkbox"
                    id="bestOfferEnabled"
                    checked={bestOfferEnabled}
                    onChange={(e) => setBestOfferEnabled(e.target.checked)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="bestOfferEnabled" className="flex-1 cursor-pointer">
                    <span className="font-medium text-gray-900">Accept Offers</span>
                    <p className="text-sm text-gray-600">Allow buyers to send you offers below your asking price</p>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {listingFormat === 'AUCTION' ? (
                    // Auction durations: 1, 3, 5, 7, 10 days (7 is recommended)
                    <>
                      <option value="DAYS_1">1 Day</option>
                      <option value="DAYS_3">3 Days</option>
                      <option value="DAYS_5">5 Days</option>
                      <option value="DAYS_7">7 Days (Recommended)</option>
                      <option value="DAYS_10">10 Days</option>
                    </>
                  ) : (
                    // Buy It Now durations: 3, 5, 7, 10, 30 days, or GTC (GTC is recommended)
                    <>
                      <option value="GTC">Good 'Til Cancelled (Recommended)</option>
                      <option value="DAYS_3">3 Days</option>
                      <option value="DAYS_5">5 Days</option>
                      <option value="DAYS_7">7 Days</option>
                      <option value="DAYS_10">10 Days</option>
                      <option value="DAYS_30">30 Days</option>
                    </>
                  )}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {listingFormat === 'AUCTION'
                    ? 'eBay recommends 7 days for auctions to maximize visibility'
                    : "Good 'Til Cancelled listings auto-renew every 30 days until sold"
                  }
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Item Specifics */}
          {step === 'specifics' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Item Specifics</h3>
                  <p className="text-sm text-gray-500">Add details to help buyers find your listing</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Add a new custom field
                    setItemSpecifics([...itemSpecifics, { name: '', value: '', required: false, editable: true }]);
                  }}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Custom Field
                </button>
              </div>

              {/* Helper to check if a field has a value */}
              {(() => {
                const hasValue = (spec: ItemSpecific) => {
                  if (Array.isArray(spec.value)) return spec.value.length > 0;
                  return spec.value && spec.value.trim() !== '';
                };

                const requiredFields = itemSpecifics.filter(s => s.required);
                const filledOptional = itemSpecifics.filter(s => !s.required && hasValue(s));
                const emptyOptional = itemSpecifics.filter(s => !s.required && !hasValue(s));

                return (
                  <>
                    {/* eBay recommended fields section */}
                    {requiredFields.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          eBay Recommended
                        </h4>
                        {requiredFields.map((spec) => {
                          const index = itemSpecifics.indexOf(spec);
                          return (
                            <div key={index} className="flex gap-3 items-start">
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  {spec.name}
                                </label>
                                <input
                                  type="text"
                                  value={Array.isArray(spec.value) ? spec.value.join(', ') : (spec.value || '')}
                                  onChange={(e) => {
                                    const newSpecifics = [...itemSpecifics];
                                    newSpecifics[index] = { ...spec, value: e.target.value };
                                    setItemSpecifics(newSpecifics);
                                  }}
                                  className="w-full px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Pre-filled optional fields */}
                    {filledOptional.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          Pre-filled from Card Data
                        </h4>
                        {filledOptional.map((spec) => {
                          const index = itemSpecifics.indexOf(spec);
                          return (
                            <div key={index} className="flex gap-3 items-start">
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  {spec.name}
                                </label>
                                <input
                                  type="text"
                                  value={Array.isArray(spec.value) ? spec.value.join(', ') : (spec.value || '')}
                                  onChange={(e) => {
                                    const newSpecifics = [...itemSpecifics];
                                    newSpecifics[index] = { ...spec, value: e.target.value };
                                    setItemSpecifics(newSpecifics);
                                  }}
                                  className="w-full px-3 py-2 border border-green-200 bg-green-50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                />
                              </div>
                              {spec.editable !== false && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newSpecifics = [...itemSpecifics];
                                    newSpecifics[index] = { ...spec, value: '' };
                                    setItemSpecifics(newSpecifics);
                                  }}
                                  className="mt-6 p-2 text-gray-400 hover:text-red-500 transition-colors"
                                  title="Clear value"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Empty optional fields - available for user input */}
                    {emptyOptional.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          Additional Options
                          <span className="text-xs text-gray-400 font-normal">({emptyOptional.length} available)</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {emptyOptional.map((spec) => {
                            const index = itemSpecifics.indexOf(spec);
                            return (
                              <div key={index} className="flex gap-2 items-start">
                                <div className="flex-1">
                                  {spec.editable && !spec.name ? (
                                    // Custom field - editable name
                                    <>
                                      <input
                                        type="text"
                                        value={spec.name}
                                        onChange={(e) => {
                                          const newSpecifics = [...itemSpecifics];
                                          newSpecifics[index] = { ...spec, name: e.target.value };
                                          setItemSpecifics(newSpecifics);
                                        }}
                                        placeholder="Field name"
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs mb-1"
                                      />
                                      <input
                                        type="text"
                                        value={Array.isArray(spec.value) ? spec.value.join(', ') : (spec.value || '')}
                                        onChange={(e) => {
                                          const newSpecifics = [...itemSpecifics];
                                          newSpecifics[index] = { ...spec, value: e.target.value };
                                          setItemSpecifics(newSpecifics);
                                        }}
                                        placeholder="Value"
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs"
                                      />
                                    </>
                                  ) : (
                                    <>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">
                                        {spec.name}
                                      </label>
                                      <input
                                        type="text"
                                        value={Array.isArray(spec.value) ? spec.value.join(', ') : (spec.value || '')}
                                        onChange={(e) => {
                                          const newSpecifics = [...itemSpecifics];
                                          newSpecifics[index] = { ...spec, value: e.target.value };
                                          setItemSpecifics(newSpecifics);
                                        }}
                                        placeholder={`Enter ${spec.name.toLowerCase()}`}
                                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs"
                                      />
                                    </>
                                  )}
                                </div>
                                {spec.editable !== false && !spec.name && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newSpecifics = itemSpecifics.filter((_, i) => i !== index);
                                      setItemSpecifics(newSpecifics);
                                    }}
                                    className="mt-5 p-1 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Remove field"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {itemSpecifics.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No item specifics available for this category.</p>
                  <p className="text-sm mt-1">Click "Add Custom Field" to add details.</p>
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                <strong>Tip:</strong> Filling in item specifics helps buyers find your listing in search results and increases visibility.
              </div>
            </div>
          )}

          {/* Step 4: Shipping & Returns */}
          {step === 'shipping' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Shipping & Returns</h3>
                <p className="text-sm text-gray-500">Configure shipping and return options for this listing.</p>
              </div>

              {/* Shipping Section */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  Shipping
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Cost</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'FREE', label: 'Free Shipping', desc: 'You cover shipping' },
                      { value: 'FLAT_RATE', label: 'Flat Rate', desc: 'Set your price' },
                      { value: 'CALCULATED', label: 'Calculated', desc: 'Based on location' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setShippingForm(f => ({ ...f, shippingType: option.value as any }))}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          shippingForm.shippingType === option.value
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-sm">{option.label}</div>
                        <div className="text-xs text-gray-500">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {shippingForm.shippingType === 'FLAT_RATE' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Price</label>
                    <div className="relative w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={shippingForm.flatRateAmount}
                        onChange={(e) => setShippingForm(f => ({ ...f, flatRateAmount: parseFloat(e.target.value) || 0 }))}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        min="0.01"
                        step="0.01"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Handling Time</label>
                  <select
                    value={shippingForm.handlingDays}
                    onChange={(e) => setShippingForm(f => ({ ...f, handlingDays: parseInt(e.target.value) }))}
                    className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value={1}>1 business day</option>
                    <option value={2}>2 business days</option>
                    <option value={3}>3 business days</option>
                    <option value={5}>5 business days</option>
                  </select>
                </div>
              </div>

              {/* Returns Section */}
              <div className="space-y-3 pt-2 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                  </svg>
                  Returns
                </h4>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shippingForm.returnsAccepted}
                      onChange={(e) => setShippingForm(f => ({ ...f, returnsAccepted: e.target.checked }))}
                      className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm font-medium text-gray-900">Accept returns</span>
                  </label>
                </div>

                {shippingForm.returnsAccepted && (
                  <div className="grid grid-cols-2 gap-4 pl-7">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Return Window</label>
                      <select
                        value={shippingForm.returnPeriodDays}
                        onChange={(e) => setShippingForm(f => ({ ...f, returnPeriodDays: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value={14}>14 days</option>
                        <option value={30}>30 days</option>
                        <option value={60}>60 days</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Return Shipping</label>
                      <select
                        value={shippingForm.returnShippingPaidBy}
                        onChange={(e) => setShippingForm(f => ({ ...f, returnShippingPaidBy: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="BUYER">Buyer pays</option>
                        <option value="SELLER">Seller pays (free returns)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                <strong>No account changes:</strong> These shipping and return options apply only to this listing and won&apos;t modify your eBay account settings.
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Listing</h3>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-gray-600">Title:</span>
                  <span className="font-medium text-gray-900 text-right max-w-[60%]">{title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{listingFormat === 'AUCTION' ? 'Starting Price:' : 'Price:'}</span>
                  <span className="font-medium text-gray-900">${parseFloat(price).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Format:</span>
                  <span className="font-medium text-gray-900">
                    {listingFormat === 'FIXED_PRICE'
                      ? bestOfferEnabled ? 'Buy It Now + Accept Offers' : 'Buy It Now'
                      : 'Auction'
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium text-gray-900">
                    {duration === 'GTC' ? "Good 'Til Cancelled" :
                     duration === 'DAYS_1' ? '1 Day' :
                     duration === 'DAYS_3' ? '3 Days' :
                     duration === 'DAYS_5' ? '5 Days' :
                     duration === 'DAYS_7' ? '7 Days' :
                     duration === 'DAYS_10' ? '10 Days' :
                     duration === 'DAYS_30' ? '30 Days' : duration}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Images:</span>
                  <span className="font-medium text-gray-900">
                    {[selectedImages.front && 'Front', selectedImages.back && 'Back', selectedImages.miniReport && 'Report'].filter(Boolean).join(', ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Grading Company:</span>
                  <span className="font-medium text-gray-900">Other (DCM)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cert Number:</span>
                  <span className="font-medium text-gray-900 font-mono">{card.serial || 'N/A'}</span>
                </div>
              </div>

              {/* Item Specifics Summary */}
              {itemSpecifics.filter(s => s.value && (Array.isArray(s.value) ? s.value.length > 0 : s.value.trim())).length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Item Specifics</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {itemSpecifics
                      .filter(s => s.value && (Array.isArray(s.value) ? s.value.length > 0 : s.value.trim()))
                      .slice(0, 6)
                      .map((spec, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-gray-500">{spec.name}:</span>
                          <span className="font-medium text-gray-900 text-right truncate max-w-[50%]">
                            {Array.isArray(spec.value) ? spec.value.join(', ') : spec.value}
                          </span>
                        </div>
                      ))}
                  </div>
                  {itemSpecifics.filter(s => s.value && (Array.isArray(s.value) ? s.value.length > 0 : s.value.trim())).length > 6 && (
                    <p className="text-xs text-gray-500 mt-2">
                      +{itemSpecifics.filter(s => s.value && (Array.isArray(s.value) ? s.value.length > 0 : s.value.trim())).length - 6} more specifics
                    </p>
                  )}
                </div>
              )}

              {/* Shipping & Returns Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Shipping & Returns</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shipping:</span>
                    <span className="font-medium text-gray-900">
                      {shippingForm.shippingType === 'FREE' ? 'Free Shipping' :
                       shippingForm.shippingType === 'FLAT_RATE' ? `$${shippingForm.flatRateAmount.toFixed(2)} Flat Rate` :
                       'Calculated'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Handling:</span>
                    <span className="font-medium text-gray-900">{shippingForm.handlingDays} business day{shippingForm.handlingDays > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Returns:</span>
                    <span className="font-medium text-gray-900">
                      {shippingForm.returnsAccepted ? `${shippingForm.returnPeriodDays} days` : 'Not accepted'}
                    </span>
                  </div>
                  {shippingForm.returnsAccepted && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Return Shipping:</span>
                      <span className="font-medium text-gray-900">
                        {shippingForm.returnShippingPaidBy === 'BUYER' ? 'Buyer pays' : 'Seller pays'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                Your listing will be published immediately on eBay.
              </div>
            </div>
          )}

          {/* Publishing State */}
          {step === 'publishing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4" />
              <p className="text-gray-600">Publishing to eBay...</p>
              <p className="text-sm text-gray-500 mt-1">This may take a moment</p>
            </div>
          )}

          {/* Success State */}
          {step === 'success' && listingResult && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Listing Created!</h3>
              <p className="text-gray-600 text-center mb-4">
                Your card has been listed on eBay.
              </p>
              {listingResult.listingUrl && (
                <a
                  href={listingResult.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  View on eBay
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
              <p className="text-xs text-gray-500 mt-4">SKU: {listingResult.sku}</p>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Listing Failed</h3>
              <p className="text-gray-600 text-center mb-4">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          {step === 'success' || step === 'publishing' ? (
            <div />
          ) : (
            <button
              onClick={step === 'images' ? onClose : handleBack}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              disabled={isLoading}
            >
              {step === 'images' ? 'Cancel' : 'Back'}
            </button>
          )}

          {step === 'success' ? (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Done
            </button>
          ) : step === 'error' ? (
            <button
              onClick={handleBack}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Try Again
            </button>
          ) : step !== 'publishing' && (
            <button
              onClick={handleNext}
              disabled={isLoading || (step === 'images' && !Object.values(selectedImages).some(Boolean))}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {step === 'review' ? 'Publish Listing' : 'Next'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
