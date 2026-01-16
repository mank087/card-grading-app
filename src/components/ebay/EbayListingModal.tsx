'use client';

import React, { useState, useEffect, useRef } from 'react';
import { pdf } from '@react-pdf/renderer';
import { generateCardImages, CardImageData } from '@/lib/cardImageGenerator';
import { generateMiniReportJpg } from '@/lib/miniReportJpgGenerator';
import { FoldableLabelData, generateQRCodeWithLogo, loadLogoAsBase64 } from '@/lib/foldableLabelGenerator';
import { getCardLabelData } from '@/lib/useLabelData';
import { getStoredSession } from '@/lib/directAuth';
import { getAuthenticatedClient } from '@/lib/directAuth';
import { LISTING_FORMATS, LISTING_DURATIONS, LISTING_DURATION_LABELS, DCM_TO_EBAY_CATEGORY, EBAY_CATEGORIES, MARKETING_SCOPE } from '@/lib/ebay/constants';
import { mapCardToItemSpecifics, getCategoryForCardType, getSerialNumbering, getSerialDenominator, type ItemSpecific } from '@/lib/ebay/itemSpecifics';
import { DOMESTIC_SHIPPING_SERVICES, INTERNATIONAL_SHIPPING_SERVICES } from '@/lib/ebay/tradingApi';
import { CardGradingReport, type ReportCardData } from '@/components/reports/CardGradingReport';

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

type ListingStep = 'images' | 'details' | 'specifics' | 'shipping' | 'promotion' | 'review' | 'publishing' | 'success' | 'error';

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

  // Ref for scrollable content container
  const contentRef = useRef<HTMLDivElement>(null);

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
    // Domestic shipping
    shippingType: 'CALCULATED' as 'FREE' | 'FLAT_RATE' | 'CALCULATED',
    domesticShippingService: 'USPSPriority',
    flatRateAmount: 5.00,
    handlingDays: 1,
    postalCode: '',
    // Package dimensions (small bubble mailer defaults)
    packageWeightOz: 4,
    packageLengthIn: 10,
    packageWidthIn: 6,
    packageDepthIn: 1,
    // International shipping
    offerInternational: false,
    internationalShippingType: 'CALCULATED' as 'FLAT_RATE' | 'CALCULATED',
    internationalShippingService: 'USPSPriorityMailInternational',
    internationalFlatRateCost: 15.00,
    internationalShipToLocations: ['Worldwide'] as string[],
    // Domestic returns
    domesticReturnsAccepted: false,
    domesticReturnPeriodDays: 30,
    domesticReturnShippingPaidBy: 'BUYER' as 'BUYER' | 'SELLER',
    // International returns
    internationalReturnsAccepted: false,
    internationalReturnPeriodDays: 30,
    internationalReturnShippingPaidBy: 'BUYER' as 'BUYER' | 'SELLER',
  });

  // Grading report document state
  const [includeGradingReport, setIncludeGradingReport] = useState(true);
  const [gradingReportDocId, setGradingReportDocId] = useState<string | null>(null);
  const [uploadingReport, setUploadingReport] = useState(false);

  // Disclaimer state
  const [disclaimerStatus, setDisclaimerStatus] = useState<'checking' | 'needs_acceptance' | 'accepted'>('checking');
  const [disclaimerCheckbox, setDisclaimerCheckbox] = useState(false);
  const [acceptingDisclaimer, setAcceptingDisclaimer] = useState(false);

  // Promotion state
  const [promotionEnabled, setPromotionEnabled] = useState(false);
  const [promotionEligible, setPromotionEligible] = useState<boolean | null>(null);
  const [promotionReason, setPromotionReason] = useState<string | null>(null);
  const [promotionNeedsReauth, setPromotionNeedsReauth] = useState(false);
  const [promotionAdRate, setPromotionAdRate] = useState(10); // Default 10%
  const [suggestedAdRate, setSuggestedAdRate] = useState(10);
  const [checkingPromotion, setCheckingPromotion] = useState(false);

  // eBay connection state
  const [ebayConnectionStatus, setEbayConnectionStatus] = useState<'checking' | 'connected' | 'not_connected' | 'needs_reauth'>('checking');
  const [ebayUsername, setEbayUsername] = useState<string | null>(null);
  const [connectingEbay, setConnectingEbay] = useState(false);

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

  // Check disclaimer status when modal opens
  useEffect(() => {
    if (isOpen) {
      checkDisclaimerStatus();
    }
  }, [isOpen]);

  // Scroll to top when step changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [step]);

  // Check eBay connection status when modal opens
  useEffect(() => {
    if (isOpen) {
      checkEbayConnection();
    }
  }, [isOpen]);

  // Listen for messages from eBay auth popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'EBAY_AUTH_COMPLETE') {
        console.log('[eBay Listing] Auth complete from popup:', event.data);
        if (event.data.success) {
          setEbayConnectionStatus('connected');
          setEbayUsername(event.data.username || null);
          // Re-check disclaimer status since they now have a connection
          checkDisclaimerStatus();
        } else {
          setError(event.data.message || 'Failed to connect eBay account');
        }
        setConnectingEbay(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkEbayConnection = async () => {
    setEbayConnectionStatus('checking');
    try {
      const session = getStoredSession();
      if (!session?.access_token) {
        setEbayConnectionStatus('not_connected');
        return;
      }

      const response = await fetch('/api/ebay/status', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.connected && data.connection) {
          const { connection } = data;
          setEbayUsername(connection.ebay_username || null);

          // Check if token is expired or about to expire (within 5 minutes)
          const tokenExpiry = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
          const isTokenExpired = tokenExpiry && tokenExpiry.getTime() < Date.now() + 5 * 60 * 1000;

          // Check if marketing scope is missing (needed for Promoted Listings)
          const hasMarketingScope = connection.scopes?.includes(MARKETING_SCOPE);

          if (isTokenExpired || !hasMarketingScope) {
            console.log('[eBay Listing] Needs reauth:', { isTokenExpired, hasMarketingScope });
            setEbayConnectionStatus('needs_reauth');
          } else {
            setEbayConnectionStatus('connected');
          }
        } else {
          setEbayConnectionStatus('not_connected');
        }
      } else {
        setEbayConnectionStatus('not_connected');
      }
    } catch (error) {
      console.error('[eBay Listing] Failed to check connection:', error);
      setEbayConnectionStatus('not_connected');
    }
  };

  const initiateEbayAuth = async () => {
    setConnectingEbay(true);
    setError(null);

    try {
      const session = getStoredSession();
      if (!session?.access_token) {
        setError('Please log in first');
        setConnectingEbay(false);
        return;
      }

      // Get the auth URL with return_url set to our success page
      const response = await fetch('/api/ebay/auth?return_url=/ebay-auth-success', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to initiate eBay authorization');
        setConnectingEbay(false);
        return;
      }

      const data = await response.json();

      // Open auth URL in a popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.authUrl,
        'ebay_auth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      // Check if popup was blocked
      if (!popup || popup.closed) {
        setError('Popup was blocked. Please allow popups for this site and try again.');
        setConnectingEbay(false);
        return;
      }

      // Poll to check if popup was closed without completing auth
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          // Give a moment for the message to arrive
          setTimeout(() => {
            if (connectingEbay) {
              setConnectingEbay(false);
            }
          }, 500);
        }
      }, 500);
    } catch (error) {
      console.error('[eBay Listing] Failed to initiate auth:', error);
      setError('Failed to start eBay authorization');
      setConnectingEbay(false);
    }
  };

  const checkDisclaimerStatus = async () => {
    setDisclaimerStatus('checking');
    setDisclaimerCheckbox(false);

    try {
      const session = getStoredSession();
      if (!session?.access_token) {
        setDisclaimerStatus('needs_acceptance');
        return;
      }

      const response = await fetch('/api/ebay/disclaimer', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.accepted) {
          setDisclaimerStatus('accepted');
        } else {
          setDisclaimerStatus('needs_acceptance');
        }
      } else {
        setDisclaimerStatus('needs_acceptance');
      }
    } catch (error) {
      console.error('[eBay Listing] Failed to check disclaimer status:', error);
      setDisclaimerStatus('needs_acceptance');
    }
  };

  const acceptDisclaimer = async () => {
    if (!disclaimerCheckbox) return;

    setAcceptingDisclaimer(true);
    try {
      const session = getStoredSession();
      if (!session?.access_token) {
        throw new Error('Not logged in');
      }

      const response = await fetch('/api/ebay/disclaimer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        setDisclaimerStatus('accepted');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to accept disclaimer');
      }
    } catch (error) {
      console.error('[eBay Listing] Failed to accept disclaimer:', error);
      setError('Failed to accept disclaimer. Please try again.');
    } finally {
      setAcceptingDisclaimer(false);
    }
  };

  // Check promotion eligibility when reaching that step
  useEffect(() => {
    if (step === 'promotion' && promotionEligible === null) {
      checkPromotionEligibility();
    }
  }, [step, promotionEligible]);

  const checkPromotionEligibility = async () => {
    setCheckingPromotion(true);
    try {
      const session = getStoredSession();
      if (!session?.access_token) {
        setPromotionEligible(false);
        setPromotionReason('Not logged in');
        return;
      }

      const response = await fetch(`/api/ebay/promotion/eligibility?categoryId=${categoryId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPromotionEligible(data.eligible);
        setPromotionReason(data.reason || null);
        setPromotionNeedsReauth(data.needsReauth || false);

        if (data.suggestedRate) {
          setSuggestedAdRate(data.suggestedRate);
          setPromotionAdRate(data.suggestedRate);
        }

        // If eligible, enable promotion by default
        if (data.eligible) {
          setPromotionEnabled(true);
        }
      } else {
        setPromotionEligible(false);
        setPromotionReason('Failed to check eligibility');
      }
    } catch (error) {
      console.error('[eBay Listing] Failed to check promotion eligibility:', error);
      setPromotionEligible(false);
      setPromotionReason('Failed to check eligibility');
    } finally {
      setCheckingPromotion(false);
    }
  };

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

  /**
   * Generate and upload the grading report as a Certificate of Analysis
   */
  const uploadGradingReport = async (): Promise<string | null> => {
    const session = getStoredSession();
    if (!session?.access_token) {
      throw new Error('Not logged in');
    }

    try {
      setUploadingReport(true);

      // Prepare label data
      const labelData = getCardLabelData(card);
      const grade = labelData.grade ?? 0;
      const cardInfo = card.conversational_card_info || {};
      const weightedScores = card.conversational_weighted_sub_scores || {};
      const subScores = card.conversational_sub_scores || {};

      // Convert card image to base64 for PDF
      const imageToBase64 = async (imageUrl: string): Promise<string> => {
        const response = await fetch(imageUrl);
        const blob = await response.blob();

        // Create canvas to convert to JPEG (PDF library doesn't support WEBP)
        const img = new Image();
        img.crossOrigin = 'anonymous';

        return new Promise((resolve, reject) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          };
          img.onerror = reject;
          img.src = URL.createObjectURL(blob);
        });
      };

      // Get card images
      let frontImageBase64 = '';
      let backImageBase64 = '';

      if (card.front_url) {
        try {
          frontImageBase64 = await imageToBase64(card.front_url);
        } catch (e) {
          console.warn('[eBay Report] Failed to load front image:', e);
        }
      }

      if (card.back_url) {
        try {
          backImageBase64 = await imageToBase64(card.back_url);
        } catch (e) {
          console.warn('[eBay Report] Failed to load back image:', e);
        }
      }

      // Generate QR code
      const qrCodeDataUrl = await generateQRCodeWithLogo(
        `https://dcmgrading.com/verify/${card.serial}`,
        await loadLogoAsBase64()
      );

      // Extract sub-scores for the report
      const centeringScore = weightedScores.centering ?? subScores.centering?.weighted ?? grade;
      const cornersScore = weightedScores.corners ?? subScores.corners?.weighted ?? grade;
      const edgesScore = weightedScores.edges ?? subScores.edges?.weighted ?? grade;
      const surfaceScore = weightedScores.surface ?? subScores.surface?.weighted ?? grade;

      // Prepare report data matching ReportCardData interface
      const reportData: ReportCardData = {
        // Unified label data
        primaryName: labelData.primaryName || labelData.line1 || '',
        contextLine: labelData.line2 || '',
        featuresLine: labelData.line3 || null,
        serial: card.serial,
        grade: grade,
        gradeFormatted: grade % 1 === 0 ? grade.toString() : grade.toFixed(1),
        condition: labelData.condition || getConditionLabel(grade),
        // Legacy fields
        cardName: cardInfo.card_name || card.card_name || '',
        playerName: cardInfo.player_or_character || card.featured || card.pokemon_featured || '',
        setName: cardInfo.set_name || card.card_set || '',
        year: cardInfo.year || '',
        manufacturer: cardInfo.manufacturer || '',
        cardNumber: cardInfo.card_number || card.card_number || '',
        sport: card.category || 'Other',
        frontImageUrl: frontImageBase64,
        backImageUrl: backImageBase64,
        conditionLabel: labelData.condition || getConditionLabel(grade),
        labelCondition: labelData.condition || getConditionLabel(grade),
        gradeRange: card.conversational_grade_uncertainty || '±0.5',
        // Professional grades
        professionalGrades: {
          psa: card.estimated_professional_grades?.psa?.grade || '-',
          bgs: card.estimated_professional_grades?.bgs?.grade || '-',
          sgc: card.estimated_professional_grades?.sgc?.grade || '-',
          cgc: card.estimated_professional_grades?.cgc?.grade || '-',
        },
        // Subgrades in expected format
        subgrades: {
          centering: {
            score: centeringScore,
            summary: subScores.centering?.notes || 'Centering assessed',
            frontScore: subScores.centering?.front ?? centeringScore,
            backScore: subScores.centering?.back ?? centeringScore,
            frontSummary: '',
            backSummary: '',
          },
          corners: {
            score: cornersScore,
            summary: subScores.corners?.notes || 'Corners assessed',
            frontScore: subScores.corners?.front ?? cornersScore,
            backScore: subScores.corners?.back ?? cornersScore,
            frontSummary: '',
            backSummary: '',
          },
          edges: {
            score: edgesScore,
            summary: subScores.edges?.notes || 'Edges assessed',
            frontScore: subScores.edges?.front ?? edgesScore,
            backScore: subScores.edges?.back ?? edgesScore,
            frontSummary: '',
            backSummary: '',
          },
          surface: {
            score: surfaceScore,
            summary: subScores.surface?.notes || 'Surface assessed',
            frontScore: subScores.surface?.front ?? surfaceScore,
            backScore: subScores.surface?.back ?? surfaceScore,
            frontSummary: '',
            backSummary: '',
          },
        },
        // Optional features
        specialFeatures: {
          autographed: cardInfo.autographed || false,
          serialNumbered: cardInfo.serial_number || undefined,
          subset: cardInfo.subset || undefined,
        },
        // Metadata
        gradedAt: card.graded_at || card.created_at || new Date().toISOString(),
        qrCodeUrl: qrCodeDataUrl,
      };

      console.log('[eBay Report] Generating PDF report...');

      // Generate PDF blob
      const pdfDoc = await pdf(<CardGradingReport cardData={reportData} />);
      const pdfBlob = await pdfDoc.toBlob();

      console.log('[eBay Report] PDF generated, uploading to eBay...');

      // Upload to eBay via our API
      const formData = new FormData();
      formData.append('file', pdfBlob, `DCM-Report-${card.serial}.pdf`);
      formData.append('fileName', `DCM-Report-${card.serial}.pdf`);

      const response = await fetch('/api/ebay/document', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('[eBay Report] Upload failed:', data.error);
        // Don't throw - we can still create the listing without the report
        return null;
      }

      const data = await response.json();
      console.log('[eBay Report] Document uploaded:', data.documentId);

      return data.documentId;
    } catch (error) {
      console.error('[eBay Report] Failed to generate/upload report:', error);
      // Don't throw - we can still create the listing without the report
      return null;
    } finally {
      setUploadingReport(false);
    }
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

      // Upload grading report as Certificate of Analysis if enabled
      let regulatoryDocumentIds: string[] = [];
      if (includeGradingReport) {
        const docId = await uploadGradingReport();
        if (docId) {
          regulatoryDocumentIds.push(docId);
          setGradingReportDocId(docId);
        }
      }

      // Create listing via Trading API with inline shipping/returns
      console.log('[eBay Listing] Creating listing for card:', card.id, 'Card object keys:', Object.keys(card));
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
          // Shipping options
          shippingType: shippingForm.shippingType,
          domesticShippingService: shippingForm.domesticShippingService,
          flatRateAmount: shippingForm.flatRateAmount,
          handlingDays: shippingForm.handlingDays,
          postalCode: shippingForm.postalCode,
          // Package dimensions
          packageWeightOz: shippingForm.packageWeightOz,
          packageLengthIn: shippingForm.packageLengthIn,
          packageWidthIn: shippingForm.packageWidthIn,
          packageDepthIn: shippingForm.packageDepthIn,
          // International shipping
          offerInternational: shippingForm.offerInternational,
          internationalShippingType: shippingForm.internationalShippingType,
          internationalShippingService: shippingForm.internationalShippingService,
          internationalFlatRateCost: shippingForm.internationalFlatRateCost,
          internationalShipToLocations: shippingForm.internationalShipToLocations,
          // Domestic returns
          domesticReturnsAccepted: shippingForm.domesticReturnsAccepted,
          domesticReturnPeriodDays: shippingForm.domesticReturnPeriodDays,
          domesticReturnShippingPaidBy: shippingForm.domesticReturnShippingPaidBy,
          // International returns
          internationalReturnsAccepted: shippingForm.internationalReturnsAccepted,
          internationalReturnPeriodDays: shippingForm.internationalReturnPeriodDays,
          internationalReturnShippingPaidBy: shippingForm.internationalReturnShippingPaidBy,
          // Regulatory documents (Certificate of Analysis)
          regulatoryDocumentIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('[eBay Listing] API error:', data);
        const debugInfo = data.debug ? ` (cardId: ${data.debug.cardId})` : '';
        throw new Error((data.error || data.details || 'Failed to create listing') + debugInfo);
      }

      const data = await response.json();

      // Create promotion if enabled and we have a listing ID
      console.log('[eBay Listing] Promotion check:', {
        promotionEnabled,
        promotionEligible,
        listingId: data.listingId,
        adRate: promotionAdRate,
        willCreatePromotion: !!(promotionEnabled && promotionEligible && data.listingId),
      });

      if (promotionEnabled && promotionEligible && data.listingId) {
        try {
          console.log('[eBay Listing] Creating promotion for listing:', data.listingId, 'with rate:', promotionAdRate);
          const promoResponse = await fetch('/api/ebay/promotion/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              listingId: data.listingId,
              bidPercentage: promotionAdRate,
            }),
          });

          if (promoResponse.ok) {
            const promoData = await promoResponse.json();
            console.log('[eBay Listing] Promotion created:', promoData);
          } else {
            // Log but don't fail the listing - promotion is optional
            const promoError = await promoResponse.json();
            console.warn('[eBay Listing] Promotion creation failed:', promoError);
          }
        } catch (promoErr) {
          // Log but don't fail the listing - promotion is optional
          console.warn('[eBay Listing] Promotion creation error:', promoErr);
        }
      }

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
        if (!shippingForm.postalCode || shippingForm.postalCode.length < 5) {
          setError('Please enter your ZIP code for shipping');
          return;
        }
        setError(null);
        setStep('promotion');
        break;
      case 'promotion':
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
      case 'promotion':
        setStep('shipping');
        break;
      case 'review':
        setStep('promotion');
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
            {['images', 'details', 'specifics', 'shipping', 'promotion', 'review'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    step === s
                      ? 'bg-purple-600 text-white'
                      : ['images', 'details', 'specifics', 'shipping', 'promotion', 'review'].indexOf(step) > i
                      ? 'bg-purple-200 text-purple-700'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i + 1}
                </div>
                {i < 5 && (
                  <div
                    className={`w-6 h-0.5 mx-0.5 ${
                      ['images', 'details', 'specifics', 'shipping', 'promotion', 'review'].indexOf(step) > i
                        ? 'bg-purple-200'
                        : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-gray-500">
            <span>Images</span>
            <span>Details</span>
            <span>Specifics</span>
            <span>Shipping</span>
            <span>Promo</span>
            <span>Review</span>
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-6">
          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* eBay Connection - Checking State */}
          {ebayConnectionStatus === 'checking' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4" />
              <p className="text-gray-600">Checking eBay connection...</p>
            </div>
          )}

          {/* eBay Connection - Not Connected */}
          {ebayConnectionStatus === 'not_connected' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.5 3C4.015 3 2 5.015 2 7.5c0 2.066 1.395 3.797 3.293 4.313L12 22l6.707-10.187C20.605 11.297 22 9.566 22 7.5 22 5.015 19.985 3 17.5 3c-1.67 0-3.138.912-3.916 2.267a.5.5 0 01-.868 0L12.5 5C11.638 3.912 10.17 3 8.5 3h-2z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Connect Your eBay Account</h3>
                <p className="text-gray-600 max-w-sm mx-auto">
                  To list your DCM graded cards on eBay, you need to connect your eBay seller account.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold text-sm">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Click Connect below</p>
                    <p className="text-sm text-gray-500">A secure eBay login window will open</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold text-sm">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Sign in to eBay</p>
                    <p className="text-sm text-gray-500">Use your eBay seller account credentials</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold text-sm">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Authorize DCM</p>
                    <p className="text-sm text-gray-500">Grant permission to create listings on your behalf</p>
                  </div>
                </div>
              </div>

              <button
                onClick={initiateEbayAuth}
                disabled={connectingEbay}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {connectingEbay ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Connect eBay Account
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                Your eBay credentials are never stored by DCM. We only receive a secure token to create listings.
              </p>
            </div>
          )}

          {/* eBay Connection - Needs Re-authorization */}
          {ebayConnectionStatus === 'needs_reauth' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">eBay Re-authorization Required</h3>
                <p className="text-gray-600 max-w-sm mx-auto">
                  {ebayUsername ? `Your eBay connection as ${ebayUsername} has expired or requires additional permissions.` : 'Your eBay connection has expired or requires additional permissions.'}
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>Why do I need to re-authorize?</strong>
                </p>
                <ul className="mt-2 text-sm text-amber-700 space-y-1">
                  <li>• Your eBay authorization token may have expired</li>
                  <li>• New features may require additional permissions</li>
                  <li>• This is a normal part of keeping your account secure</li>
                </ul>
              </div>

              <button
                onClick={initiateEbayAuth}
                disabled={connectingEbay}
                className="w-full py-3 px-4 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:bg-amber-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {connectingEbay ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Re-authorize eBay Account
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                You&apos;ll be redirected to eBay to re-authorize DCM. This only takes a moment.
              </p>
            </div>
          )}

          {/* Disclaimer - Loading State (only show if eBay is connected) */}
          {ebayConnectionStatus === 'connected' && disclaimerStatus === 'checking' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4" />
              <p className="text-gray-600">Loading...</p>
            </div>
          )}

          {/* Disclaimer - Needs Acceptance (only show if eBay is connected) */}
          {ebayConnectionStatus === 'connected' && disclaimerStatus === 'needs_acceptance' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">eBay Listing Terms & Conditions</h3>
                <p className="text-gray-600">Please review and accept before listing on eBay</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-[400px] overflow-y-auto text-sm text-gray-700 space-y-4">
                <p className="font-semibold text-gray-900">
                  By using DCM&apos;s eBay listing feature, you acknowledge and agree to the following:
                </p>

                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">1. DCM is Not a Party to Your eBay Transactions</h4>
                    <p>DCM (Digital Card Marketplace) provides this listing tool solely as a convenience feature to help you list your DCM-graded cards on eBay. DCM is not a party to any transaction that occurs on the eBay platform. All sales, purchases, and related activities are conducted exclusively between you and the buyer through eBay.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900">2. No Liability for eBay Transactions</h4>
                    <p>DCM shall not be held liable for any disputes, claims, damages, losses, or issues arising from your eBay listings or sales, including but not limited to: buyer complaints, return requests, refund disputes, shipping issues, payment problems, listing violations, account suspensions, or any other matters related to your eBay activity.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900">3. Grading Opinions</h4>
                    <p>DCM grades represent our professional assessment of card condition at the time of grading. Grades are opinions and are not guarantees of value, authenticity, or future market performance. Buyers may have different opinions regarding condition, and you are responsible for handling any disputes that may arise.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900">4. Your Responsibilities</h4>
                    <p>You are solely responsible for:</p>
                    <ul className="list-disc ml-5 mt-1 space-y-1">
                      <li>The accuracy of all listing information (titles, descriptions, prices, shipping terms)</li>
                      <li>Compliance with eBay&apos;s terms of service, listing policies, and all applicable laws</li>
                      <li>Handling all buyer communications, shipping, returns, and refunds</li>
                      <li>Any fees, taxes, or costs associated with your eBay sales</li>
                      <li>Ensuring you have the legal right to sell the items you list</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900">5. Indemnification</h4>
                    <p>You agree to indemnify, defend, and hold harmless DCM, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, costs, or expenses (including reasonable attorneys&apos; fees) arising from or related to your use of this eBay listing feature or any eBay transactions.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900">6. eBay Account</h4>
                    <p>You are responsible for maintaining your eBay account in good standing. DCM is not responsible for any actions eBay may take against your account, including but not limited to listing removals, selling restrictions, or account suspensions.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900">7. Service Availability</h4>
                    <p>DCM provides this listing feature &quot;as is&quot; and makes no guarantees regarding its availability, accuracy, or functionality. DCM may modify, suspend, or discontinue this feature at any time without notice.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900">8. Governing Law</h4>
                    <p>These terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through binding arbitration or in the courts of competent jurisdiction.</p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                  Last updated: January 2026 | Version 1.0
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={disclaimerCheckbox}
                  onChange={(e) => setDisclaimerCheckbox(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">
                  I have read and agree to the terms and conditions above. I understand that DCM is not responsible for any transactions that occur on eBay.
                </span>
              </label>

              <button
                onClick={acceptDisclaimer}
                disabled={!disclaimerCheckbox || acceptingDisclaimer}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  disclaimerCheckbox && !acceptingDisclaimer
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {acceptingDisclaimer ? 'Processing...' : 'Accept & Continue'}
              </button>
            </div>
          )}

          {/* Brief reminder banner for returning users */}
          {disclaimerStatus === 'accepted' && step !== 'publishing' && step !== 'success' && step !== 'error' && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>Reminder:</strong> DCM provides this listing tool as a convenience. All eBay transactions are between you and the buyer. DCM is not responsible for sales, disputes, or any issues arising from your eBay listings.
              </span>
            </div>
          )}

          {/* Step 1: Images */}
          {disclaimerStatus === 'accepted' && step === 'images' && (
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
                    <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center">
                      {imageUrls.front && (
                        <img src={imageUrls.front} alt="Front" className="max-w-full max-h-full object-contain" />
                      )}
                    </div>
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
                    <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center">
                      {imageUrls.back && (
                        <img src={imageUrls.back} alt="Back" className="max-w-full max-h-full object-contain" />
                      )}
                    </div>
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
                    <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center">
                      {imageUrls.miniReport && (
                        <img src={imageUrls.miniReport} alt="Mini Report" className="max-w-full max-h-full object-contain" />
                      )}
                    </div>
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
          {disclaimerStatus === 'accepted' && step === 'details' && (
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
          {disclaimerStatus === 'accepted' && step === 'specifics' && (
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
          {disclaimerStatus === 'accepted' && step === 'shipping' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Shipping & Returns</h3>
                <p className="text-sm text-gray-500">Configure shipping and return options for this listing.</p>
              </div>

              {/* Domestic Shipping Section */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  Domestic Shipping
                </h4>

                {/* Shipping Type Selection - Calculated first */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Cost Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'CALCULATED', label: 'Calculated', desc: 'Based on buyer location' },
                      { value: 'FREE', label: 'Free Shipping', desc: 'You cover shipping' },
                      { value: 'FLAT_RATE', label: 'Flat Rate', desc: 'Set your price' },
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

                {/* Flat Rate Amount */}
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

                {/* Shipping Service */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Service</label>
                  <select
                    value={shippingForm.domesticShippingService}
                    onChange={(e) => setShippingForm(f => ({ ...f, domesticShippingService: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {DOMESTIC_SHIPPING_SERVICES.map((service) => (
                      <option key={service.value} value={service.value}>{service.label}</option>
                    ))}
                  </select>
                </div>

                {/* Package Details */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h5 className="text-sm font-medium text-gray-700">Package Details</h5>
                  <p className="text-xs text-gray-500">Pre-filled for a small bubble mailer. Adjust if needed.</p>

                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Weight (oz)</label>
                      <input
                        type="number"
                        value={shippingForm.packageWeightOz}
                        onChange={(e) => setShippingForm(f => ({ ...f, packageWeightOz: parseInt(e.target.value) || 0 }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Length (in)</label>
                      <input
                        type="number"
                        value={shippingForm.packageLengthIn}
                        onChange={(e) => setShippingForm(f => ({ ...f, packageLengthIn: parseInt(e.target.value) || 0 }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Width (in)</label>
                      <input
                        type="number"
                        value={shippingForm.packageWidthIn}
                        onChange={(e) => setShippingForm(f => ({ ...f, packageWidthIn: parseInt(e.target.value) || 0 }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Depth (in)</label>
                      <input
                        type="number"
                        value={shippingForm.packageDepthIn}
                        onChange={(e) => setShippingForm(f => ({ ...f, packageDepthIn: parseInt(e.target.value) || 0 }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        min="1"
                      />
                    </div>
                  </div>
                </div>

                {/* Postal Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ship From ZIP Code</label>
                  <input
                    type="text"
                    value={shippingForm.postalCode}
                    onChange={(e) => setShippingForm(f => ({ ...f, postalCode: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                    placeholder="e.g. 90210"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    maxLength={5}
                  />
                  {!shippingForm.postalCode && (
                    <p className="text-xs text-amber-600 mt-1">Required for shipping calculations</p>
                  )}
                </div>

                {/* Handling Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Handling Time</label>
                  <select
                    value={shippingForm.handlingDays}
                    onChange={(e) => setShippingForm(f => ({ ...f, handlingDays: parseInt(e.target.value) }))}
                    className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value={1}>1 business day</option>
                    <option value={2}>2 business days</option>
                    <option value={3}>3 business days</option>
                    <option value={5}>5 business days</option>
                  </select>
                </div>
              </div>

              {/* International Shipping Section */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    International Shipping
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shippingForm.offerInternational}
                      onChange={(e) => setShippingForm(f => ({ ...f, offerInternational: e.target.checked }))}
                      className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Ship internationally</span>
                  </label>
                </div>

                {shippingForm.offerInternational && (
                  <div className="pl-4 space-y-3 border-l-2 border-purple-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Type</label>
                        <select
                          value={shippingForm.internationalShippingType}
                          onChange={(e) => setShippingForm(f => ({ ...f, internationalShippingType: e.target.value as any }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="CALCULATED">Calculated</option>
                          <option value="FLAT_RATE">Flat Rate</option>
                        </select>
                      </div>

                      {shippingForm.internationalShippingType === 'FLAT_RATE' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">International Rate</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <input
                              type="number"
                              value={shippingForm.internationalFlatRateCost}
                              onChange={(e) => setShippingForm(f => ({ ...f, internationalFlatRateCost: parseFloat(e.target.value) || 0 }))}
                              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              min="0.01"
                              step="0.01"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">International Service</label>
                      <select
                        value={shippingForm.internationalShippingService}
                        onChange={(e) => setShippingForm(f => ({ ...f, internationalShippingService: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        {INTERNATIONAL_SHIPPING_SERVICES.map((service) => (
                          <option key={service.value} value={service.value}>{service.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ship To</label>
                      <select
                        value={shippingForm.internationalShipToLocations[0] || 'Worldwide'}
                        onChange={(e) => setShippingForm(f => ({ ...f, internationalShipToLocations: [e.target.value] }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="Worldwide">Worldwide</option>
                        <option value="Americas">Americas</option>
                        <option value="Europe">Europe</option>
                        <option value="Asia">Asia</option>
                        <option value="CA">Canada</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AU">Australia</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Returns Section */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                  </svg>
                  Returns
                </h4>

                {/* Domestic Returns */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shippingForm.domesticReturnsAccepted}
                        onChange={(e) => setShippingForm(f => ({ ...f, domesticReturnsAccepted: e.target.checked }))}
                        className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-gray-900">Accept domestic returns</span>
                    </label>
                  </div>

                  {shippingForm.domesticReturnsAccepted && (
                    <div className="grid grid-cols-2 gap-4 pl-7">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Return Window</label>
                        <select
                          value={shippingForm.domesticReturnPeriodDays}
                          onChange={(e) => setShippingForm(f => ({ ...f, domesticReturnPeriodDays: parseInt(e.target.value) }))}
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
                          value={shippingForm.domesticReturnShippingPaidBy}
                          onChange={(e) => setShippingForm(f => ({ ...f, domesticReturnShippingPaidBy: e.target.value as any }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="BUYER">Buyer pays</option>
                          <option value="SELLER">Seller pays (free returns)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* International Returns */}
                {shippingForm.offerInternational && (
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shippingForm.internationalReturnsAccepted}
                          onChange={(e) => setShippingForm(f => ({ ...f, internationalReturnsAccepted: e.target.checked }))}
                          className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-900">Accept international returns</span>
                      </label>
                    </div>

                    {shippingForm.internationalReturnsAccepted && (
                      <div className="grid grid-cols-2 gap-4 pl-7">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Return Window</label>
                          <select
                            value={shippingForm.internationalReturnPeriodDays}
                            onChange={(e) => setShippingForm(f => ({ ...f, internationalReturnPeriodDays: parseInt(e.target.value) }))}
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
                            value={shippingForm.internationalReturnShippingPaidBy}
                            onChange={(e) => setShippingForm(f => ({ ...f, internationalReturnShippingPaidBy: e.target.value as any }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="BUYER">Buyer pays</option>
                            <option value="SELLER">Seller pays (free returns)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                <strong>No account changes:</strong> These shipping and return options apply only to this listing and won&apos;t modify your eBay account settings.
              </div>
            </div>
          )}

          {/* Step 5: Promotion */}
          {disclaimerStatus === 'accepted' && step === 'promotion' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Promoted Listings</h3>
                <p className="text-sm text-gray-500">Boost your listing&apos;s visibility in search results. You only pay when your item sells.</p>
              </div>

              {checkingPromotion ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                  <span className="ml-3 text-gray-600">Checking eligibility...</span>
                </div>
              ) : promotionEligible === false ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Promoted Listings Unavailable</h4>
                      <p className="text-sm text-gray-600 mt-1">{promotionReason}</p>
                      {promotionNeedsReauth && (
                        <p className="text-sm text-purple-600 mt-2">
                          You can reconnect your eBay account from your Account page to enable this feature.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Enable/Disable Toggle */}
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">Promote this listing</span>
                        <p className="text-xs text-gray-500">Increase visibility in eBay search results</p>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={promotionEnabled}
                        onChange={(e) => setPromotionEnabled(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors ${promotionEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${promotionEnabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                      </div>
                    </div>
                  </label>

                  {/* Ad Rate Slider */}
                  {promotionEnabled && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">Ad Rate</span>
                        <span className="text-lg font-bold text-purple-600">{promotionAdRate}%</span>
                      </div>

                      <input
                        type="range"
                        min="2"
                        max="30"
                        step="1"
                        value={promotionAdRate}
                        onChange={(e) => setPromotionAdRate(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />

                      <div className="flex justify-between text-xs text-gray-500">
                        <span>2%</span>
                        <span>Suggested: {suggestedAdRate}%</span>
                        <span>30%</span>
                      </div>

                      {/* Quick select buttons */}
                      <div className="flex gap-2">
                        {[5, 10, 15, 20].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => setPromotionAdRate(rate)}
                            className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                              promotionAdRate === rate
                                ? 'bg-purple-100 border-purple-300 text-purple-700'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {rate}%
                          </button>
                        ))}
                      </div>

                      {/* Fee estimate */}
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">If sold at ${parseFloat(price || '0').toFixed(2)}:</span>
                          <span className="font-medium text-gray-900">
                            ${(parseFloat(price || '0') * promotionAdRate / 100).toFixed(2)} ad fee
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          You only pay this fee if your item sells through a promoted placement.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Info box */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-start gap-2">
                    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <strong>How it works:</strong> Promoted Listings appear higher in search results. You set an ad rate (% of sale price) and only pay when your item sells through a promoted placement.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Review */}
          {disclaimerStatus === 'accepted' && step === 'review' && (
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
                <div className="space-y-2 text-sm">
                  {/* Domestic Shipping */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Domestic:</span>
                      <span className="font-medium text-gray-900">
                        {shippingForm.shippingType === 'FREE' ? 'Free Shipping' :
                         shippingForm.shippingType === 'FLAT_RATE' ? `$${shippingForm.flatRateAmount.toFixed(2)} Flat Rate` :
                         'Calculated'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Handling:</span>
                      <span className="font-medium text-gray-900">{shippingForm.handlingDays} day{shippingForm.handlingDays > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ship From:</span>
                      <span className="font-medium text-gray-900">{shippingForm.postalCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Package:</span>
                      <span className="font-medium text-gray-900">{shippingForm.packageWeightOz}oz, {shippingForm.packageLengthIn}&quot;x{shippingForm.packageWidthIn}&quot;x{shippingForm.packageDepthIn}&quot;</span>
                    </div>
                  </div>

                  {/* International Shipping */}
                  {shippingForm.offerInternational && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between">
                        <span className="text-gray-500">International:</span>
                        <span className="font-medium text-gray-900">
                          {shippingForm.internationalShippingType === 'FLAT_RATE'
                            ? `$${shippingForm.internationalFlatRateCost.toFixed(2)} Flat Rate`
                            : 'Calculated'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Returns */}
                  <div className="pt-2 border-t border-gray-200 grid grid-cols-2 gap-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Domestic Returns:</span>
                      <span className="font-medium text-gray-900">
                        {shippingForm.domesticReturnsAccepted ? `${shippingForm.domesticReturnPeriodDays} days` : 'Not accepted'}
                      </span>
                    </div>
                    {shippingForm.offerInternational && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Int&apos;l Returns:</span>
                        <span className="font-medium text-gray-900">
                          {shippingForm.internationalReturnsAccepted ? `${shippingForm.internationalReturnPeriodDays} days` : 'Not accepted'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Promotion Summary */}
              {promotionEligible && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Promoted Listing</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Promotion:</span>
                    <span className="font-medium text-gray-900">
                      {promotionEnabled ? (
                        <span className="text-purple-600">{promotionAdRate}% ad rate</span>
                      ) : (
                        <span className="text-gray-500">Not enabled</span>
                      )}
                    </span>
                  </div>
                  {promotionEnabled && (
                    <p className="text-xs text-gray-500 mt-2">
                      If sold at ${parseFloat(price || '0').toFixed(2)} through promotion: ${(parseFloat(price || '0') * promotionAdRate / 100).toFixed(2)} ad fee
                    </p>
                  )}
                </div>
              )}

              {/* Product Documents */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Product Documents</h4>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeGradingReport}
                    onChange={(e) => setIncludeGradingReport(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Include DCM Grading Report</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Attach the full DCM grading report as a Certificate of Analysis. This provides buyers with detailed condition information.
                    </p>
                  </div>
                </label>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                Your listing will be published immediately on eBay.
                {promotionEnabled && promotionEligible && ' Promotion will be activated after publishing.'}
              </div>
            </div>
          )}

          {/* Publishing State */}
          {step === 'publishing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4" />
              <p className="text-gray-600">
                {uploadingReport ? 'Generating grading report...' : 'Publishing to eBay...'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {uploadingReport ? 'Uploading Certificate of Analysis' : 'This may take a moment'}
              </p>
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
              <div className="flex flex-col sm:flex-row gap-3">
                {listingResult.listingUrl && (
                  <a
                    href={listingResult.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View on eBay
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
                <a
                  href="/upload"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Grade Another Card
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </a>
              </div>
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
        <div className="px-6 py-4 border-t border-gray-200">
          {/* eBay Account Status */}
          {ebayConnectionStatus === 'connected' && ebayUsername && step !== 'success' && step !== 'publishing' && (
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Connected as <span className="font-medium text-gray-900">{ebayUsername}</span></span>
              </div>
              <button
                onClick={async () => {
                  if (!confirm('Are you sure you want to disconnect your eBay account?')) return;
                  try {
                    const session = getStoredSession();
                    if (!session?.access_token) return;
                    const response = await fetch('/api/ebay/disconnect', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    if (response.ok) {
                      setEbayConnectionStatus('not_connected');
                      setEbayUsername(null);
                    }
                  } catch (error) {
                    console.error('Failed to disconnect:', error);
                  }
                }}
                className="text-sm text-gray-500 hover:text-red-600 transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between">
          {/* Left side - Cancel/Back button */}
          {ebayConnectionStatus === 'checking' ? (
            <div />
          ) : ebayConnectionStatus === 'not_connected' || ebayConnectionStatus === 'needs_reauth' ? (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
          ) : disclaimerStatus === 'checking' ? (
            <div />
          ) : disclaimerStatus === 'needs_acceptance' ? (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
          ) : step === 'success' || step === 'publishing' ? (
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

          {/* Right side - Next/Action button */}
          {ebayConnectionStatus !== 'connected' ? (
            <div />
          ) : disclaimerStatus !== 'accepted' ? (
            <div />
          ) : step === 'success' ? (
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
    </div>
  );
};
