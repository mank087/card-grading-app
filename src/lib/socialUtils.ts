/**
 * Social sharing utility functions for DCM Card Grading App
 */

export interface CardSharingData {
  id?: string;
  cardName?: string;
  playerName?: string;
  setName?: string;
  year?: string;
  manufacturer?: string;
  grade?: number;
  gradeUncertainty?: string;
  url?: string;
  // Legacy fields for backward compatibility
  card_name?: string;
  featured?: string;
  card_set?: string;
  release_date?: string;
  dcm_grade_whole?: number;
  ai_confidence_score?: string;
  front_url?: string;
  serial?: string;
}

/**
 * Detect if user is on mobile device
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Generate Facebook share URL with pre-populated quote
 * Uses the 'quote' parameter which Facebook displays as suggested text
 * @param cardData - Card data for generating share content
 * @param isOwner - Whether the current user owns this card (affects message wording)
 */
export function generateFacebookShareUrl(cardData: CardSharingData, isOwner: boolean = true): string {
  const cardUrl = cardData.url || `https://dcmgrading.com/sports/${cardData.id}`;
  const quote = generateFacebookQuote(cardData, isOwner);

  const params = new URLSearchParams({
    u: cardUrl,
    quote: quote
  });

  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
}

/**
 * Generate the pre-populated Facebook quote/message
 * Owner format: My "Card Name" just graded on DCM as a "score". Check it out here:
 * Non-owner format: Check out this "Card Name" that graded as a "score" on DCM:
 */
function generateFacebookQuote(cardData: CardSharingData, isOwner: boolean): string {
  // Build the card name from available fields
  const cardName = buildCardDisplayName(cardData);

  // Get the grade score
  const grade = cardData.grade || cardData.dcm_grade_whole;

  if (isOwner) {
    if (grade) {
      return `My "${cardName}" just graded on DCM as a ${grade}. Check it out here:`;
    } else {
      return `My "${cardName}" just graded on DCM. Check it out here:`;
    }
  } else {
    if (grade) {
      return `Check out this "${cardName}" that graded as a ${grade} on DCM:`;
    } else {
      return `Check out this "${cardName}" graded on DCM:`;
    }
  }
}

/**
 * Build a display name for the card from available data
 */
function buildCardDisplayName(cardData: CardSharingData): string {
  const parts: string[] = [];

  // Add player/featured name if available
  const playerName = cardData.playerName || cardData.featured;
  if (playerName) parts.push(playerName);

  // Add card name if different from player name
  const cardName = cardData.cardName || cardData.card_name;
  if (cardName && cardName !== playerName) parts.push(cardName);

  // Add year and set info
  const year = cardData.year || cardData.release_date;
  const set = cardData.setName || cardData.card_set;
  const manufacturer = cardData.manufacturer;

  const setInfo: string[] = [];
  if (year) setInfo.push(year);
  if (manufacturer) setInfo.push(manufacturer);
  if (set) setInfo.push(set);

  if (setInfo.length > 0) {
    parts.push(setInfo.join(' '));
  }

  // Return combined name or fallback
  return parts.length > 0 ? parts.join(' - ') : 'Card';
}

/**
 * Generate Twitter share URL
 * @param cardData - Card data for generating share content
 * @param isOwner - Whether the current user owns this card (affects message wording)
 */
export function generateTwitterShareUrl(cardData: CardSharingData, isOwner: boolean = true): string {
  const cardUrl = cardData.url || `https://dcmgrading.com/sports/${cardData.id}`;
  const text = generateTwitterText(cardData, isOwner);

  const params = new URLSearchParams({
    url: cardUrl,
    text: text,
    hashtags: 'DCMGrading,CardGrading'
  });

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * Generate the pre-populated Twitter text
 * Owner format: My "Card Name" just graded on DCM as a "score". Check it out here:
 * Non-owner format: Check out this "Card Name" that graded as a "score" on DCM:
 */
function generateTwitterText(cardData: CardSharingData, isOwner: boolean): string {
  const cardName = buildCardDisplayName(cardData);
  const grade = cardData.grade || cardData.dcm_grade_whole;

  if (isOwner) {
    if (grade) {
      return `My "${cardName}" just graded on DCM as a ${grade}. Check it out here:`;
    } else {
      return `My "${cardName}" just graded on DCM. Check it out here:`;
    }
  } else {
    if (grade) {
      return `Check out this "${cardName}" that graded as a ${grade} on DCM:`;
    } else {
      return `Check out this "${cardName}" graded on DCM:`;
    }
  }
}

/**
 * Generate Instagram sharing content (mobile app or copy text)
 */
export function handleInstagramShare(cardData: CardSharingData): void {
  const text = generateInstagramCaption(cardData);

  if (isMobile()) {
    // Try to open Instagram app
    const instagramUrl = 'instagram://story-camera';
    window.open(instagramUrl, '_blank');

    // Fallback: copy text to clipboard
    setTimeout(() => {
      copyToClipboard(text);
      alert('Instagram content copied to clipboard! Paste it when you create your story.');
    }, 1000);
  } else {
    // Desktop: copy caption and show instructions
    copyToClipboard(text);
    alert('Instagram caption copied to clipboard! Open Instagram on your phone and paste when creating a post.');
  }
}

/**
 * Copy card URL to clipboard
 */
export function copyCardUrl(cardData: CardSharingData, baseUrl: string = 'https://dcmgrading.com'): void {
  const cardUrl = `${baseUrl}/sports/${cardData.id}`;
  copyToClipboard(cardUrl);
}

/**
 * Copy text to clipboard
 */
export function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);

  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
      textArea.remove();
      return Promise.resolve(true);
    } catch (err) {
      textArea.remove();
      return Promise.resolve(false);
    }
  }
}

/**
 * Generate sharing text for Facebook/Twitter
 */
function generateShareText(cardData: CardSharingData): string {
  // Use new fields with fallback to legacy fields
  const playerName = cardData.playerName || cardData.featured || cardData.cardName || cardData.card_name || 'Card';
  const cardName = cardData.cardName || cardData.card_name || '';
  const grade = cardData.grade || cardData.dcm_grade_whole;
  const imageQuality = cardData.gradeUncertainty || cardData.ai_confidence_score || 'B';
  const year = cardData.year || cardData.release_date || '';
  const set = cardData.setName || cardData.card_set || '';
  const manufacturer = cardData.manufacturer || '';

  // Build card details line: Player - Card Name - Year Manufacturer Set
  const cardDetails: string[] = [];
  if (playerName && playerName !== 'Card') cardDetails.push(playerName);
  if (cardName && cardName !== playerName) cardDetails.push(cardName);

  const setInfo: string[] = [];
  if (year) setInfo.push(year);
  if (manufacturer) setInfo.push(manufacturer);
  if (set) setInfo.push(set);
  if (setInfo.length > 0) cardDetails.push(setInfo.join(' '));

  let text = cardDetails.join(' - ');

  // Add grade in format: 9.2/A or 9/A
  if (grade) {
    text += `\nDCM Grade: ${grade}/${imageQuality}`;
  }

  return text;
}

/**
 * Generate Instagram caption
 */
function generateInstagramCaption(cardData: CardSharingData): string {
  // Use new fields with fallback to legacy fields
  const playerName = cardData.playerName || cardData.featured || cardData.cardName || cardData.card_name || 'Card';
  const cardName = cardData.cardName || cardData.card_name || '';
  const grade = cardData.grade || cardData.dcm_grade_whole;
  const imageQuality = cardData.gradeUncertainty || cardData.ai_confidence_score || 'B';
  const year = cardData.year || cardData.release_date || '';
  const set = cardData.setName || cardData.card_set || '';
  const manufacturer = cardData.manufacturer || '';

  // Build card details line: Player - Card Name - Year Manufacturer Set
  const cardDetails: string[] = [];
  if (playerName && playerName !== 'Card') cardDetails.push(playerName);
  if (cardName && cardName !== playerName) cardDetails.push(cardName);

  const setInfo: string[] = [];
  if (year) setInfo.push(year);
  if (manufacturer) setInfo.push(manufacturer);
  if (set) setInfo.push(set);
  if (setInfo.length > 0) cardDetails.push(setInfo.join(' '));

  let caption = cardDetails.join(' - ') + '\n\n';

  // Add grade in format: 9.2/A or 9/A
  if (grade) {
    caption += `DCM Grade: ${grade}/${imageQuality}\n\n`;
  }

  caption += `Professional card grading and authentication.\n\n`;

  // Generate hashtags - clean up player name for hashtag
  const hashtags: string[] = ['#DCMGrading', '#SportsCards', '#CardGrading'];
  if (playerName && playerName !== 'Card') {
    hashtags.push(`#${playerName.replace(/\s+/g, '')}`);
  }
  if (set && !set.toLowerCase().includes('unknown')) {
    hashtags.push(`#${set.replace(/\s+/g, '')}`);
  }
  hashtags.push('#CardCollector', '#TradingCards');

  caption += hashtags.join(' ');

  return caption;
}

/**
 * Open social sharing in new window
 */
export function openSocialShare(url: string): void {
  const width = 600;
  const height = 400;
  const left = (window.innerWidth / 2) - (width / 2);
  const top = (window.innerHeight / 2) - (height / 2);

  window.open(
    url,
    'social-share',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

/**
 * Show success message for social sharing
 */
export function showShareSuccess(platform: string): void {
  // You can customize this to show a toast notification or modal
  console.log(`Successfully shared to ${platform}!`);
}